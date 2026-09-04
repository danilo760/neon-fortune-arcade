import puppeteer from "puppeteer-core";

const url = process.env.OLYMPUS_URL ?? "http://127.0.0.1:4173/game/olympus-storm";
const chrome = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const runs = Number(process.env.OLYMPUS_PROFILE_RUNS ?? 3);

function metricMap(metrics) {
  return Object.fromEntries(metrics.map(({ name, value }) => [name, value]));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function runOnce(index) {
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-background-timer-throttling"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const client = await page.createCDPSession();
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await client.send("Performance.enable");

  await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
  await page.evaluate(() => {
    localStorage.setItem("lucky-neon-arcade:v1", JSON.stringify({
      balance: 1_000_000,
      favorites: [],
      soundEnabled: false,
      history: [],
      totalSpins: 0,
      bestWin: 0,
    }));
  });
  await page.reload({ waitUntil: "networkidle0", timeout: 60_000 });
  await page.waitForSelector('[aria-label="Girar Olympus Storm"]', { timeout: 30_000 });

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));

  await page.click('[aria-label="Alternar turbo"]');
  const before = metricMap((await client.send("Performance.getMetrics")).metrics);

  await page.evaluate(() => {
    const state = {
      start: performance.now(),
      frames: [],
      longTasks: [],
      mutations: 0,
      lastFrame: performance.now(),
      stop: false,
    };
    window.__olympusPerf = state;
    const observer = new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) state.longTasks.push(entry.duration);
    });
    try { observer.observe({ entryTypes: ["longtask"] }); } catch {}
    const mutationObserver = new MutationObserver((records) => { state.mutations += records.length; });
    mutationObserver.observe(document.querySelector(".os-ref-machine") ?? document.body, {
      attributes: true, childList: true, subtree: true, characterData: true,
    });
    function frame(now) {
      if (state.stop) return;
      state.frames.push(now - state.lastFrame);
      state.lastFrame = now;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    window.__olympusPerfCleanup = () => {
      state.stop = true;
      observer.disconnect();
      mutationObserver.disconnect();
    };
  });

  await page.click('[aria-label="Auto play"]');
  await page.waitForSelector('[aria-label="Parar auto play"]', { timeout: 15_000 });
  await page.waitForFunction(() => {
    const auto = document.querySelector('[aria-label="Auto play"]');
    const spin = document.querySelector('[aria-label="Girar Olympus Storm"]');
    return Boolean(auto && spin && spin.getAttribute("aria-busy") !== "true");
  }, { timeout: 120_000, polling: 100 });

  const perf = await page.evaluate(() => {
    window.__olympusPerfCleanup?.();
    const state = window.__olympusPerf;
    const elapsed = performance.now() - state.start;
    const validFrames = state.frames.filter((value) => value > 0 && value < 1000);
    return {
      elapsedMs: elapsed,
      fps: validFrames.length / (elapsed / 1000),
      worstFrameMs: validFrames.length ? Math.max(...validFrames) : 0,
      p95FrameMs: validFrames.length ? [...validFrames].sort((a,b)=>a-b)[Math.floor(validFrames.length * .95)] : 0,
      longTasks: state.longTasks.length,
      maxLongTaskMs: state.longTasks.length ? Math.max(...state.longTasks) : 0,
      mutations: state.mutations,
    };
  });
  const after = metricMap((await client.send("Performance.getMetrics")).metrics);
  await browser.close();

  const result = {
    run: index + 1,
    fps: Number(perf.fps.toFixed(3)),
    worstFrameMs: Number(perf.worstFrameMs.toFixed(3)),
    p95FrameMs: Number((perf.p95FrameMs ?? 0).toFixed(3)),
    longTasks: perf.longTasks,
    maxLongTaskMs: Number(perf.maxLongTaskMs.toFixed(3)),
    scriptMs: Number((((after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0)) * 1000).toFixed(3)),
    taskMs: Number((((after.TaskDuration ?? 0) - (before.TaskDuration ?? 0)) * 1000).toFixed(3)),
    layoutMs: Number((((after.LayoutDuration ?? 0) - (before.LayoutDuration ?? 0)) * 1000).toFixed(3)),
    recalcStyleMs: Number((((after.RecalcStyleDuration ?? 0) - (before.RecalcStyleDuration ?? 0)) * 1000).toFixed(3)),
    layoutCount: (after.LayoutCount ?? 0) - (before.LayoutCount ?? 0),
    recalcStyleCount: (after.RecalcStyleCount ?? 0) - (before.RecalcStyleCount ?? 0),
    renderMutations: perf.mutations,
    overflowX: overflow.scrollWidth > overflow.clientWidth,
    viewport: "390x844",
    cpuThrottle: 4,
  };
  console.log("OLYMPUS_PROFILE_RUN", JSON.stringify(result));
  return result;
}

const samples = [];
for (let index = 0; index < runs; index += 1) samples.push(await runOnce(index));

const keys = ["fps", "worstFrameMs", "p95FrameMs", "scriptMs", "taskMs", "layoutMs", "recalcStyleMs", "layoutCount", "recalcStyleCount", "renderMutations", "longTasks", "maxLongTaskMs"];
const summary = Object.fromEntries(keys.map((key) => [key, Number(median(samples.map((sample) => sample[key])).toFixed(3))]));
summary.overflowX = samples.some((sample) => sample.overflowX);
summary.viewport = "390x844";
summary.cpuThrottle = 4;
console.log("OLYMPUS_PROFILE_MEDIAN", JSON.stringify(summary));
