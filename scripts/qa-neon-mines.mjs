import puppeteer from "puppeteer-core";

const url = "http://127.0.0.1:4173/game/neon-mines";
const storageKey = "lucky-neon-arcade:v1";
const initialState = {
  balance: 1_000_000,
  favorites: [],
  soundEnabled: true,
  history: [],
  totalSpins: 0,
  bestWin: 0,
};

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-background-timer-throttling"],
});

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function summarize(values) {
  return {
    samples: values.length,
    meanMs: Number(mean(values).toFixed(1)),
    medianMs: Number(median(values).toFixed(1)),
    minMs: Number(Math.min(...values).toFixed(1)),
    maxMs: Number(Math.max(...values).toFixed(1)),
  };
}

async function newPage({ width = 390, height = 844, cpu = 1, reduced = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  if (reduced) {
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  }
  const cdp = await page.target().createCDPSession();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console:${message.text()}`);
  });
  await page.evaluateOnNewDocument(({ storageKey, initialState }) => {
    localStorage.setItem(storageKey, JSON.stringify(initialState));
  }, { storageKey, initialState });
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60_000 });
  await page.waitForFunction(() => document.body.innerText.includes("NEON") && document.body.innerText.includes("MINES"));
  return { page, errors };
}

async function clickByPrefix(page, prefix) {
  const handle = await page.evaluateHandle((prefix) =>
    [...document.querySelectorAll("button")].find((button) =>
      (button.getAttribute("aria-label") || "").startsWith(prefix),
    ) || null,
  prefix);
  const element = handle.asElement();
  if (!element) throw new Error(`Missing button with aria prefix: ${prefix}`);
  await element.click();
  await handle.dispose();
}

async function setRisk(page, count) {
  await page.waitForFunction((count) =>
    [...document.querySelectorAll("button")].some((button) =>
      (button.getAttribute("aria-label") || "").startsWith(`${count} minas, risco`) && !button.disabled,
    ), {}, count);
  await clickByPrefix(page, `${count} minas, risco`);
  await page.waitForFunction((count) =>
    document.querySelector('.mines-premium__cabinet')?.getAttribute('data-risk-level') ===
      (count === 1 ? 'low' : count === 3 ? 'medium' : count === 5 ? 'high' : 'extreme'), {}, count);
}

async function startRound(page) {
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some((button) =>
      (button.getAttribute("aria-label") || "").startsWith("Abrir cofre apostando") && !button.disabled,
    ));
  await clickByPrefix(page, "Abrir cofre apostando");
  await page.waitForFunction(() => document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status') === 'playing');
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some((button) =>
      (button.getAttribute("aria-label") || "").startsWith("Revelar casa") && !button.disabled,
    ));
}

async function revealOne(page) {
  const meta = await page.evaluate(() => {
    const tile = [...document.querySelectorAll("button")].find((button) =>
      (button.getAttribute("aria-label") || "").startsWith("Revelar casa") && !button.disabled,
    );
    const label = tile?.getAttribute("aria-label") || null;
    const index = label ? Number(label.match(/(\d+)/)?.[1] || 0) : 0;
    return { label, index };
  });
  if (!meta.label || !meta.index) throw new Error("No revealable tile");

  const started = performance.now();
  await clickByPrefix(page, meta.label);
  await page.waitForFunction((index) => {
    const safe = [...document.querySelectorAll("button")].some((button) =>
      button.getAttribute("aria-label") === `Casa ${index}, segura`,
    );
    const lost = document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status') === 'lost';
    return safe || lost;
  }, {}, meta.index);

  const lost = await page.evaluate(() =>
    document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status') === 'lost');
  if (lost) return { outcome: "mine", elapsed: performance.now() - started, index: meta.index };

  await page.waitForFunction(() =>
    document.querySelector('.mines-premium__cabinet')?.getAttribute('data-reveal-phase') === 'idle' &&
    [...document.querySelectorAll("button")].some((button) =>
      (button.getAttribute("aria-label") || "").startsWith("Revelar casa") && !button.disabled,
    ));
  return { outcome: "safe", elapsed: performance.now() - started, index: meta.index };
}

async function cashout(page) {
  const started = performance.now();
  await clickByPrefix(page, "Garantir ganho de");
  await page.waitForFunction(() =>
    document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status') === 'won');
  return performance.now() - started;
}

async function resetState(page) {
  await page.evaluate(({ storageKey, initialState }) => localStorage.setItem(storageKey, JSON.stringify(initialState)), { storageKey, initialState });
  await page.reload({ waitUntil: "networkidle2" });
}

// Main performance harness: same viewport, CPU throttle, risk and round count as baseline.
const { page, errors } = await newPage({ width: 390, height: 844, cpu: 4 });
await setRisk(page, 3);
await page.evaluate(() => {
  window.__minesPerf = { frames: [], longTasks: 0, mutations: 0, overflow: false, last: performance.now() };
  const perf = window.__minesPerf;
  const tick = (now) => {
    const dt = now - perf.last;
    perf.last = now;
    if (dt > 0 && dt < 1000) perf.frames.push(dt);
    perf.overflow ||= document.documentElement.scrollWidth > innerWidth + 1;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((list) => { perf.longTasks += list.getEntries().length; }).observe({ entryTypes: ["longtask"] });
  } catch {}
  new MutationObserver((records) => { perf.mutations += records.length; }).observe(document.body, {
    subtree: true, childList: true, attributes: true, characterData: true,
  });
});

const safeTimes = [];
const mineTimes = [];
const cashoutTimes = [];
let rounds = 0;
let cashouts = 0;
let losses = 0;

while (cashouts < 5 && rounds < 14) {
  await startRound(page);
  rounds += 1;
  const result = await revealOne(page);
  if (result.outcome === "mine") {
    mineTimes.push(result.elapsed);
    losses += 1;
  } else {
    safeTimes.push(result.elapsed);
    cashoutTimes.push(await cashout(page));
    cashouts += 1;
  }
}
while (losses < 5 && rounds < 20) {
  await startRound(page);
  rounds += 1;
  while (true) {
    const result = await revealOne(page);
    if (result.outcome === "mine") {
      mineTimes.push(result.elapsed);
      losses += 1;
      break;
    }
    safeTimes.push(result.elapsed);
  }
}
if (rounds < 10 || safeTimes.length < 5 || mineTimes.length < 5 || cashoutTimes.length < 5) {
  throw new Error(`Insufficient performance samples rounds=${rounds} safe=${safeTimes.length} mine=${mineTimes.length} cashout=${cashoutTimes.length}`);
}

await new Promise((resolve) => setTimeout(resolve, 250));
const perf = await page.evaluate(() => window.__minesPerf);
const frames = perf.frames.slice(5);
const sortedFrames = [...frames].sort((a, b) => a - b);
const worstFrame = Math.max(...frames);
const p95Frame = sortedFrames[Math.min(sortedFrames.length - 1, Math.floor(sortedFrames.length * 0.95))];
const performanceReport = {
  viewport: "390x844",
  cpuThrottle: 4,
  mines: 3,
  rounds,
  safeReveal: summarize(safeTimes),
  mineReveal: summarize(mineTimes),
  cashout: summarize(cashoutTimes),
  fpsAverage: Number((1000 / mean(frames)).toFixed(2)),
  fpsMinimum: Number((1000 / worstFrame).toFixed(2)),
  worstFrameMs: Number(worstFrame.toFixed(2)),
  p95FrameMs: Number(p95Frame.toFixed(2)),
  longTasks: perf.longTasks,
  domMutations: perf.mutations,
  overflowHorizontal: perf.overflow || await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
  consoleErrors: errors,
};
console.log("MINES_AFTER", JSON.stringify(performanceReport));
if (performanceReport.safeReveal.medianMs < 320 || performanceReport.safeReveal.medianMs > 420) {
  throw new Error(`Safe reveal missed 320-420 ms gate: ${performanceReport.safeReveal.medianMs}`);
}
if (performanceReport.mineReveal.medianMs < 400 || performanceReport.mineReveal.medianMs > 550) {
  throw new Error(`Mine reveal missed 400-550 ms gate: ${performanceReport.mineReveal.medianMs}`);
}
if (performanceReport.cashout.medianMs < 450 || performanceReport.cashout.medianMs > 650) {
  throw new Error(`Cashout missed 450-650 ms gate: ${performanceReport.cashout.medianMs}`);
}
if (performanceReport.overflowHorizontal || errors.length) throw new Error(`Performance smoke errors: ${errors.join(" | ")}`);

// UI localization audit.
const localization = await page.evaluate(() => {
  const body = document.body.innerText;
  const forbidden = ["SAFE GEMS", "remaining", "NEXT WIN", "POSSIBLE WIN", "MINES / RISK", "SECURING", "OPEN VAULT", "Vault breached", "Crystal secured", "CASH OUT"];
  return {
    forbiddenFound: forbidden.filter((term) => body.includes(term)),
    requiredFound: ["GEMAS SEGURAS", "PRÓXIMO GANHO", "RISCO", "MULTIPLICADOR", "ENCONTRADAS", "GANHO POSSÍVEL", "MINAS / RISCO", "ABRIR COFRE"].filter((term) => body.includes(term)),
  };
});
if (localization.forbiddenFound.length) throw new Error(`English functional UI remains: ${localization.forbiddenFound.join(", ")}`);
if (localization.requiredFound.length !== 8) throw new Error(`Missing PT-BR UI: ${JSON.stringify(localization)}`);

// Start-round double click: one debit, one paid round.
await resetState(page);
await setRisk(page, 3);
const beforeStart = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), storageKey);
const bet = await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || "").startsWith("Abrir cofre apostando"));
  return Number((button?.getAttribute("aria-label") || "").replace(/\D/g, ""));
});
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || "").startsWith("Abrir cofre apostando"));
  if (!(button instanceof HTMLButtonElement)) throw new Error("start missing");
  button.click(); button.click();
});
await page.waitForFunction(() => document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status') === 'playing');
const afterStart = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), storageKey);
if (afterStart.totalSpins !== beforeStart.totalSpins + 1 || afterStart.balance !== beforeStart.balance - bet) {
  throw new Error(`Double start accounting failed: ${JSON.stringify({ beforeStart, afterStart, bet })}`);
}

// Rapid tap: only one reveal/loss is accepted while revealBusyRef is held.
const beforeRapidHistory = afterStart.history.length;
await page.evaluate(() => {
  const buttons = [...document.querySelectorAll("button")].filter((b) => (b.getAttribute("aria-label") || "").startsWith("Revelar casa") && !b.disabled).slice(0, 8);
  buttons.forEach((button) => button.click());
});
await page.waitForFunction(() => {
  const cabinet = document.querySelector('.mines-premium__cabinet');
  return cabinet?.getAttribute('data-round-status') === 'lost' || cabinet?.getAttribute('data-reveal-phase') === 'idle';
});
const rapid = await page.evaluate((key) => ({
  safe: [...document.querySelectorAll("button")].filter((b) => /Casa \d+, segura/.test(b.getAttribute("aria-label") || "")).length,
  state: JSON.parse(localStorage.getItem(key) || "{}"),
  status: document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status'),
}), storageKey);
const rapidAccepted = rapid.safe + (rapid.status === "lost" ? rapid.state.history.length - beforeRapidHistory : 0);
if (rapidAccepted !== 1) throw new Error(`Rapid tap accepted ${rapidAccepted} reveals: ${JSON.stringify(rapid)}`);

// Double cashout: find a safe first reveal, then fire the cashout twice in the same task.
await resetState(page);
await setRisk(page, 3);
let safeReady = false;
for (let attempt = 0; attempt < 8 && !safeReady; attempt += 1) {
  await startRound(page);
  const result = await revealOne(page);
  if (result.outcome === "safe") safeReady = true;
}
if (!safeReady) throw new Error("Could not obtain safe tile for double cashout test");
const beforeCash = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), storageKey);
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || "").startsWith("Garantir ganho de"));
  if (!(button instanceof HTMLButtonElement)) throw new Error("cashout missing");
  button.click(); button.click();
});
await page.waitForFunction(() => document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status') === 'won');
const afterCash = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), storageKey);
if (afterCash.history.length !== beforeCash.history.length + 1) throw new Error("Double cashout recorded more than one round");
const cashEntry = afterCash.history[0];
if (afterCash.balance !== beforeCash.balance + cashEntry.payout) throw new Error(`Double cashout credited incorrectly: ${JSON.stringify({ beforeCash, afterCash, cashEntry })}`);

// Reduced motion: waits collapse while the same semantic flow remains intact.
const reducedContext = await newPage({ width: 390, height: 844, cpu: 4, reduced: true });
const reducedPage = reducedContext.page;
await setRisk(reducedPage, 3);
await startRound(reducedPage);
const reducedStarted = performance.now();
const reducedResult = await revealOne(reducedPage);
const reducedElapsed = performance.now() - reducedStarted;
if (reducedElapsed > 220) throw new Error(`Reduced-motion reveal remained blocked too long: ${reducedElapsed.toFixed(1)} ms`);
if (reducedContext.errors.length) throw new Error(`Reduced-motion console errors: ${reducedContext.errors.join(" | ")}`);
await reducedPage.close();

// Mobile viewport and risk-control audit.
const mobile = [];
for (const [width, height] of [[360,800],[390,844],[430,932]]) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await resetState(page);
  const info = await page.evaluate(() => {
    const start = [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || "").startsWith("Abrir cofre apostando"));
    const riskButtons = [...document.querySelectorAll("button")].filter((b) => /minas, risco/.test(b.getAttribute("aria-label") || ""));
    const grid = document.querySelector('.mines-premium__grid');
    const selector = document.querySelector('.mines-premium__selector');
    const rect = (el) => el?.getBoundingClientRect().toJSON() || null;
    return {
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      start: rect(start), grid: rect(grid), selector: rect(selector),
      riskLabels: riskButtons.map((b) => b.getAttribute("aria-label")),
      innerHeight,
    };
  });
  if (info.overflow || !info.start || !info.grid || !info.selector || info.riskLabels.length !== 4) {
    throw new Error(`Mobile layout failed ${width}x${height}: ${JSON.stringify(info)}`);
  }
  mobile.push({ viewport: `${width}x${height}`, ...info });
}

// Exercise all requested risks without throttling: multiple gems, mine, cashout, restart.
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
const riskReport = [];
for (const risk of [1, 5, 10]) {
  await resetState(page);
  await setRisk(page, risk);
  let sawMine = false;
  let didCashout = false;
  let didThreeSafeCashout = false;
  let starts = 0;
  while ((!sawMine || !didCashout || !didThreeSafeCashout) && starts < 18) {
    await startRound(page);
    starts += 1;
    let safeCount = 0;
    while (true) {
      const result = await revealOne(page);
      if (result.outcome === "mine") {
        sawMine = true;
        break;
      }
      safeCount += 1;
      if (!didCashout && safeCount >= 1) {
        await cashout(page);
        didCashout = true;
        break;
      }
      if (!didThreeSafeCashout && safeCount >= 3) {
        await cashout(page);
        didThreeSafeCashout = true;
        break;
      }
    }
  }
  if (!sawMine || !didCashout || !didThreeSafeCashout) {
    throw new Error(`Risk QA incomplete for ${risk}: ${JSON.stringify({ sawMine, didCashout, didThreeSafeCashout, starts })}`);
  }
  riskReport.push({ risk, sawMine, didCashout, didThreeSafeCashout, starts });
}

console.log("MINES_QA", JSON.stringify({
  performance: performanceReport,
  localization,
  doubleStart: { bet, balanceBefore: beforeStart.balance, balanceAfter: afterStart.balance, spinsBefore: beforeStart.totalSpins, spinsAfter: afterStart.totalSpins },
  rapidTap: { accepted: rapidAccepted, status: rapid.status, safe: rapid.safe },
  doubleCashout: { payout: cashEntry.payout, balanceBefore: beforeCash.balance, balanceAfter: afterCash.balance },
  reducedMotion: { outcome: reducedResult.outcome, elapsedMs: Number(reducedElapsed.toFixed(1)) },
  mobile,
  risks: riskReport,
}));

await page.close();
await browser.close();
