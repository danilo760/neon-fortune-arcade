import puppeteer from "puppeteer-core";

const ROOT = process.env.CANDY_AUDIT_URL ?? "http://127.0.0.1:4173";
const GAME = `${ROOT}/game/candy-cascade`;
const STORAGE_KEY = "lucky-neon-arcade:v1";

function state(balance = 1_000_000) {
  return { balance, favorites: [], soundEnabled: false, history: [], totalSpins: 0, bestWin: 0 };
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const client = await page.target().createCDPSession();
await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

await page.goto(ROOT, { waitUntil: "networkidle2", timeout: 60_000 });
await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: state() });
await page.goto(GAME, { waitUntil: "networkidle2", timeout: 60_000 });

await page.evaluate(() => {
  window.__candyQa = { start: performance.now(), frames: [], last: 0, long: [] };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__candyQa.long.push(entry.duration);
    }).observe({ entryTypes: ["longtask"] });
  } catch {}
  const tick = (time) => {
    if (window.__candyQa.last) window.__candyQa.frames.push(time - window.__candyQa.last);
    window.__candyQa.last = time;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

async function buttonByAria(part, enabledOnly = true) {
  const handle = await page.evaluateHandle(({ part, enabledOnly }) => [...document.querySelectorAll("button")].find((button) => {
    const label = button.getAttribute("aria-label") ?? "";
    return label.includes(part) && (!enabledOnly || !button.disabled);
  }) ?? null, { part, enabledOnly });
  const element = handle.asElement();
  if (!element) { await handle.dispose(); throw new Error(`button not found: ${part}`); }
  return { element, handle };
}

async function clickAria(part) {
  const { element, handle } = await buttonByAria(part);
  await element.click();
  await handle.dispose();
}

async function waitSpinIdle() {
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find((candidate) => (candidate.getAttribute("aria-label") ?? "").includes("Girar Candy Cascade"));
    return button && button.getAttribute("aria-busy") !== "true" && !button.disabled;
  }, { timeout: 45_000 });
}

async function readState() {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), STORAGE_KEY);
}

await clickAria("Ativar turbo");
let baseSpins = 0;
for (let index = 0; index < 30; index += 1) {
  await waitSpinIdle();
  await clickAria("Girar Candy Cascade");
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((button) => (button.getAttribute("aria-label") ?? "").includes("Girar Candy Cascade") && button.getAttribute("aria-busy") === "true"), { timeout: 5_000 });
  await waitSpinIdle();
  baseSpins += 1;
}

const beforeFeatures = await readState();
let featureBuys = 0;
let doubleClickPassed = false;
let accountingPassed = true;
let modalText = "";

for (let index = 0; index < 5; index += 1) {
  await clickAria("Abrir Sugar Party Bonus Buy");
  await page.waitForSelector('[data-testid="candy-feature-modal"]', { timeout: 5_000 });
  modalText = await page.$eval('[data-testid="candy-feature-modal"]', (node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "");
  const before = await readState();

  if (index === 0) {
    await page.evaluate(() => {
      const activate = document.querySelector('[data-testid="candy-feature-activate"]');
      if (!(activate instanceof HTMLButtonElement)) throw new Error("activate missing");
      activate.click();
      activate.click();
    });
  } else {
    const activate = await page.$('[data-testid="candy-feature-activate"]');
    if (!activate) throw new Error("activate missing");
    await activate.click();
  }

  await page.waitForFunction(() => !document.querySelector('[data-testid="candy-feature-modal"]'), { timeout: 8_000 });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find((candidate) => (candidate.getAttribute("aria-label") ?? "").includes("Abrir Sugar Party Bonus Buy"));
    return button && !button.disabled;
  }, { timeout: 60_000 });
  const after = await readState();
  const newEntries = after.history.filter((entry) => entry.slug === "candy-cascade" && entry.note?.includes("Sugar Party") && !before.history.some((old) => old.id === entry.id));
  if (index === 0) doubleClickPassed = newEntries.length === 1;
  const entry = newEntries[0];
  if (!entry) throw new Error(`Feature ${index + 1} did not create one aggregated history entry`);
  accountingPassed = accountingPassed && newEntries.length === 1 && after.balance === before.balance - entry.bet + entry.payout;
  featureBuys += 1;
}

const afterFeatures = await readState();
const featureSpinsDidNotDebit = afterFeatures.totalSpins === beforeFeatures.totalSpins;
const featureEntries = afterFeatures.history.filter((entry) => entry.slug === "candy-cascade" && entry.note?.includes("Sugar Party"));

await clickAria(afterFeatures.soundEnabled ? "Desativar som" : "Ativar som");
const toggledState = await readState();
const soundTogglePassed = toggledState.soundEnabled !== afterFeatures.soundEnabled;

const qa390 = await page.evaluate(({ baseSpins, featureBuys, errors, modalText, doubleClickPassed, accountingPassed, featureSpinsDidNotDebit, soundTogglePassed, featureEntries }) => {
  const qa = window.__candyQa;
  const elapsed = performance.now() - qa.start;
  const sorted = [...qa.frames].sort((a, b) => a - b);
  return {
    viewport: [innerWidth, innerHeight],
    baseSpins,
    featureBuys,
    fps: qa.frames.length / (elapsed / 1000),
    worstFrameMs: sorted.at(-1) ?? 0,
    p95FrameMs: sorted[Math.floor(sorted.length * .95)] ?? 0,
    longTasks: qa.long.length,
    maxLongTaskMs: Math.max(0, ...qa.long),
    heap: performance.memory?.usedJSHeapSize ?? null,
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    errors,
    modalText,
    doubleClickPassed,
    accountingPassed,
    featureSpinsDidNotDebit,
    soundTogglePassed,
    aggregatedFeatureEntries: featureEntries.length,
    bonusButtonVisible: [...document.querySelectorAll("button")].some((button) => (button.getAttribute("aria-label") ?? "").includes("Abrir Sugar Party Bonus Buy")),
    soundButtonVisible: [...document.querySelectorAll("button")].some((button) => /som/.test(button.getAttribute("aria-label") ?? "")),
  };
}, { baseSpins, featureBuys, errors, modalText, doubleClickPassed, accountingPassed, featureSpinsDidNotDebit, soundTogglePassed, featureEntries });

const viewportResults = [];
for (const [width, height] of [[360, 800], [430, 932]]) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: "networkidle2" });
  viewportResults.push(await page.evaluate(() => ({
    viewport: [innerWidth, innerHeight],
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    bonusVisible: [...document.querySelectorAll("button")].some((button) => (button.getAttribute("aria-label") ?? "").includes("Abrir Sugar Party Bonus Buy")),
    soundVisible: [...document.querySelectorAll("button")].some((button) => /som/.test(button.getAttribute("aria-label") ?? "")),
  })));
}

await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: state(100) });
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.reload({ waitUntil: "networkidle2" });
await clickAria("Abrir Sugar Party Bonus Buy");
await page.waitForSelector('[data-testid="candy-feature-modal"]');
const insufficient = await page.evaluate(() => {
  const modal = document.querySelector('[data-testid="candy-feature-modal"]');
  const activate = document.querySelector('[data-testid="candy-feature-activate"]');
  return {
    text: modal?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    activateDisabled: activate instanceof HTMLButtonElement ? activate.disabled : null,
  };
});
const insufficientPassed = insufficient.activateDisabled === true && /insuficiente/i.test(insufficient.text);

const result = { ...qa390, viewportResults, insufficientPassed };
console.log("CANDY_BROWSER_AUDIT", JSON.stringify(result));

if (result.baseSpins !== 30 || result.featureBuys !== 5) throw new Error("QA did not complete 30 spins + 5 Feature Buys");
if (!result.doubleClickPassed || !result.accountingPassed || !result.featureSpinsDidNotDebit || !result.insufficientPassed) throw new Error("Candy purchase/accounting invariant failed");
if (!result.soundTogglePassed || !result.bonusButtonVisible || !result.soundButtonVisible) throw new Error("Candy controls QA failed");
if (result.overflowX || result.viewportResults.some((item) => item.overflowX || !item.bonusVisible || !item.soundVisible)) throw new Error("Candy mobile viewport QA failed");
if (result.errors.length) throw new Error(`Browser console errors: ${result.errors.join(" | ")}`);

await browser.close();
