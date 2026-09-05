import puppeteer from "puppeteer-core";

const ROOT = "http://127.0.0.1:4173";
const GAME = `${ROOT}/game/candy-cascade`;
const STORAGE_KEY = "lucky-neon-arcade:v1";
const SAMPLES = 3;
const SPINS = 30;

const initialState = () => ({ balance: 1_000_000, favorites: [], soundEnabled: false, history: [], totalSpins: 0, bestWin: 0 });

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function clickAria(page, part) {
  const handle = await page.evaluateHandle((needle) => [...document.querySelectorAll("button")].find((button) => (button.getAttribute("aria-label") ?? "").includes(needle) && !button.disabled) ?? null, part);
  const element = handle.asElement();
  if (!element) { await handle.dispose(); throw new Error(`button not found: ${part}`); }
  await element.click();
  await handle.dispose();
}

async function waitIdle(page) {
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find((candidate) => (candidate.getAttribute("aria-label") ?? "").includes("Girar Candy Cascade"));
    return button && button.getAttribute("aria-busy") !== "true" && !button.disabled;
  }, { timeout: 45_000 });
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const samples = [];

for (let sample = 0; sample < SAMPLES; sample += 1) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const client = await page.target().createCDPSession();
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluateOnNewDocument((seed) => {
    let state = seed >>> 0;
    Math.random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  }, 0xcafe0000 + sample * 97);
  await page.goto(ROOT, { waitUntil: "networkidle2", timeout: 60_000 });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: initialState() });
  await page.goto(GAME, { waitUntil: "networkidle2", timeout: 60_000 });
  await clickAria(page, "Ativar turbo");
  await page.evaluate(() => {
    window.__profile = { start: performance.now(), frames: [], last: 0, long: [], mutations: 0 };
    try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__profile.long.push(entry.duration); }).observe({ entryTypes: ["longtask"] }); } catch {}
    new MutationObserver((list) => { window.__profile.mutations += list.length; }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    const tick = (time) => { const p = window.__profile; if (p.last) p.frames.push(time - p.last); p.last = time; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });

  for (let spin = 0; spin < SPINS; spin += 1) {
    await waitIdle(page);
    await clickAria(page, "Girar Candy Cascade");
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some((button) => (button.getAttribute("aria-label") ?? "").includes("Girar Candy Cascade") && button.getAttribute("aria-busy") === "true"), { timeout: 5_000 });
    await waitIdle(page);
  }

  const result = await page.evaluate((spins) => {
    const p = window.__profile;
    const elapsed = performance.now() - p.start;
    const sorted = [...p.frames].sort((a, b) => a - b);
    const stored = JSON.parse(localStorage.getItem("lucky-neon-arcade:v1") ?? "{}");
    return {
      spins,
      fps: p.frames.length / (elapsed / 1000),
      worstFrameMs: sorted.at(-1) ?? 0,
      p95FrameMs: sorted[Math.floor(sorted.length * .95)] ?? 0,
      longTasks: p.long.length,
      maxLongTaskMs: Math.max(0, ...p.long),
      mutations: p.mutations,
      heap: performance.memory?.usedJSHeapSize ?? null,
      elapsedMs: elapsed,
      totalSpins: stored.totalSpins ?? null,
      sugarPartyHistory: Array.isArray(stored.history) ? stored.history.filter((entry) => String(entry.note ?? "").includes("Sugar Party")).length : null,
    };
  }, SPINS);
  samples.push(result);
  await page.close();
}

await browser.close();
const summary = {
  samples,
  median: {
    fps: median(samples.map((x) => x.fps)),
    worstFrameMs: median(samples.map((x) => x.worstFrameMs)),
    p95FrameMs: median(samples.map((x) => x.p95FrameMs)),
    longTasks: median(samples.map((x) => x.longTasks)),
    maxLongTaskMs: median(samples.map((x) => x.maxLongTaskMs)),
    mutations: median(samples.map((x) => x.mutations)),
    heap: median(samples.map((x) => x.heap ?? 0)),
    elapsedMs: median(samples.map((x) => x.elapsedMs)),
  },
};
console.log("CANDY_BASE_PROFILE", JSON.stringify(summary));
