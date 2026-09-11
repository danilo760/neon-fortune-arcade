import { mkdir, writeFile } from "node:fs/promises";

const appUrl = process.env.GOLDEN_TIGER_URL ?? "http://127.0.0.1:3000/game/golden-tiger";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9222";
const outputDir = process.env.GOLDEN_TIGER_QA_DIR ?? "artifacts/golden-tiger/playtest";
const viewport = { width: 390, height: 844 };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Three deliberately mixed rows with non-matching diagonals, then a high
// feature-trigger roll. In visual-QA builds this yields a fast deterministic
// loss without touching production RNG behavior.
const LOSS_ROUND = [
  0.06, 0.15, 0.25,
  0.40, 0.55, 0.70,
  0.90, 0.06, 0.15,
  0.90,
];

class CdpClient {
  constructor(url) {
    this.url = url;
    this.id = 0;
    this.pending = new Map();
    this.socket = null;
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP websocket timeout")), 8_000);
      this.socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.socket.addEventListener("error", (event) => {
        clearTimeout(timer);
        reject(new Error(`CDP websocket error: ${String(event?.message ?? "unknown")}`));
      }, { once: true });
    });

    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    if (!this.socket) throw new Error("CDP socket not connected");
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket?.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(`Browser evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
  return result.result?.value;
}

async function waitFor(client, expression, label, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(client, expression)) return;
    await sleep(20);
  }
  const debug = await evaluate(client, `(() => ({
    phase: document.querySelector('.gt-hw-machine')?.getAttribute('data-phase') ?? null,
    spins: window.__gtPlaytest?.baseSpins ?? null,
    autoText: [...document.querySelectorAll('button')].map((button) => button.textContent?.trim()).find((text) => text?.includes('PARAR')) ?? null,
  }))()`);
  throw new Error(`Timed out waiting for ${label}; debug=${JSON.stringify(debug)}`);
}

async function screenshot(client, path) {
  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(path, Buffer.from(result.data, "base64"));
}

async function createTarget() {
  const response = await fetch(`${cdpUrl}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Could not create Chrome target: ${response.status}`);
  return response.json();
}

async function closeTarget(id) {
  await fetch(`${cdpUrl}/json/close/${id}`).catch(() => undefined);
}

async function state(client) {
  return evaluate(client, `(() => ({
    phase: document.querySelector('.gt-hw-machine')?.getAttribute('data-phase') ?? null,
    spins: window.__gtPlaytest?.baseSpins ?? 0,
    turbo: document.querySelector('.gt-premium-secondary button[aria-pressed="true"]')?.textContent?.includes('TURBO') ?? false,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    spinDisabled: document.querySelector('.gt-hw-spin')?.disabled ?? true,
  }))()`);
}

function assertViewport(current, label) {
  if (current.scrollWidth !== viewport.width || current.scrollHeight !== viewport.height) {
    throw new Error(`${label}: viewport overflow ${current.scrollWidth}x${current.scrollHeight}`);
  }
}

async function queueLossRounds(client, count) {
  await evaluate(client, `(() => {
    window.__gtQaRandom.queue = ${JSON.stringify(LOSS_ROUND)}.flatMap((value) => [value]);
    if (${count} > 1) {
      const one = [...window.__gtQaRandom.queue];
      window.__gtQaRandom.queue = Array.from({ length: ${count} }, () => one).flat();
    }
    window.__gtQaRandom.fallback = 0.9;
    return window.__gtQaRandom.queue.length;
  })()`);
}

async function runManualRounds(client, count, label) {
  const before = (await state(client)).spins;
  const timings = [];

  for (let index = 0; index < count; index += 1) {
    await queueLossRounds(client, 1);
    const started = Date.now();
    await evaluate(client, `document.querySelector('.gt-hw-spin')?.click()`);
    await waitFor(client, `document.querySelector('.gt-hw-machine')?.getAttribute('data-phase') !== 'idle'`, `${label} ${index + 1} start`, 3_000);
    await waitFor(client, `document.querySelector('.gt-hw-machine')?.getAttribute('data-phase') === 'idle'`, `${label} ${index + 1} settle`, 20_000);
    timings.push(Date.now() - started);
    const current = await state(client);
    assertViewport(current, `${label} ${index + 1}`);
  }

  const after = (await state(client)).spins;
  if (after - before !== count) throw new Error(`${label}: expected ${count} base spins, observed ${after - before}`);
  return timings;
}

await mkdir(outputDir, { recursive: true });
const target = await createTarget();
const client = new CdpClient(target.webSocketDebuggerUrl);
const report = { viewport, normal: null, turbo: null, auto: null };

try {
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });

  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const random = { queue: [], fallback: 0.9, calls: 0 };
      Object.defineProperty(window, '__gtQaRandom', { value: random, configurable: true });
      Math.random = () => {
        random.calls += 1;
        return random.queue.length ? random.queue.shift() : random.fallback;
      };
      window.__gtPlaytest = { baseSpins: 0, phases: [] };
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type !== 'attributes' || record.attributeName !== 'data-phase') continue;
          const phase = record.target.getAttribute('data-phase');
          window.__gtPlaytest.phases.push(phase);
          if (phase === 'base-spin') window.__gtPlaytest.baseSpins += 1;
        }
      });
      const attach = () => {
        const machine = document.querySelector('.gt-hw-machine');
        if (machine) observer.observe(machine, { attributes: true, attributeFilter: ['data-phase'] });
        else requestAnimationFrame(attach);
      };
      requestAnimationFrame(attach);
    })();`,
  });

  await client.send("Page.navigate", { url: appUrl });
  await waitFor(client, `document.readyState === 'complete'`, "document load");
  await waitFor(client, `Boolean(document.querySelector('.gt-hw-spin:not(:disabled)'))`, "spin button");
  await sleep(450);
  await waitFor(client, `document.querySelector('.gt-hw-machine')?.getAttribute('data-phase') === 'idle'`, "hydrated idle");

  // Keep the deterministic sequence exclusive to gameplay math during this
  // rhythm test. Audio has its own dedicated unit/integration coverage.
  const soundButton = await evaluate(client, `(() => {
    const button = document.querySelector('.gt-hw-icon-button[aria-label="Desativar som"]');
    if (button) button.click();
    return Boolean(button);
  })()`);

  const initial = await state(client);
  assertViewport(initial, "initial");

  const normalTimings = await runManualRounds(client, 10, "NORMAL");
  report.normal = {
    rounds: 10,
    minMs: Math.min(...normalTimings),
    maxMs: Math.max(...normalTimings),
    avgMs: Math.round(normalTimings.reduce((sum, value) => sum + value, 0) / normalTimings.length),
  };
  await screenshot(client, `${outputDir}/normal-10-complete.png`);

  await evaluate(client, `(() => {
    const button = [...document.querySelectorAll('.gt-premium-secondary button')].find((candidate) => candidate.textContent?.includes('TURBO'));
    button?.click();
    return Boolean(button);
  })()`);
  await waitFor(client, `Boolean(document.querySelector('.gt-premium-secondary button[aria-pressed="true"]'))`, "Turbo active");

  const turboTimings = await runManualRounds(client, 10, "TURBO");
  report.turbo = {
    rounds: 10,
    minMs: Math.min(...turboTimings),
    maxMs: Math.max(...turboTimings),
    avgMs: Math.round(turboTimings.reduce((sum, value) => sum + value, 0) / turboTimings.length),
  };
  if (report.turbo.avgMs >= report.normal.avgMs) {
    throw new Error(`Turbo should be faster than Normal: normal=${report.normal.avgMs}ms turbo=${report.turbo.avgMs}ms`);
  }
  await screenshot(client, `${outputDir}/turbo-10-complete.png`);

  const autoBefore = (await state(client)).spins;
  await queueLossRounds(client, 10);
  await evaluate(client, `(() => {
    const button = [...document.querySelectorAll('.gt-premium-secondary button')].find((candidate) => candidate.textContent?.includes('AUTO'));
    button?.click();
    return Boolean(button);
  })()`);
  await waitFor(client, `Boolean(document.querySelector('.gt-hw-modal'))`, "Auto modal");
  await evaluate(client, `(() => {
    const modal = document.querySelector('.gt-hw-modal');
    const ten = [...modal.querySelectorAll('nav button')].find((button) => button.textContent?.trim() === '10');
    ten?.click();
    const start = [...modal.querySelectorAll('footer button')].find((button) => button.textContent?.includes('INICIAR'));
    start?.click();
    return Boolean(ten && start);
  })()`);
  await waitFor(client, `[...document.querySelectorAll('.gt-premium-secondary button')].some((button) => button.textContent?.includes('PARAR'))`, "Auto 10 start", 4_000);
  const autoStartedAt = Date.now();
  await waitFor(client, `(() => {
    const spins = window.__gtPlaytest?.baseSpins ?? 0;
    const phase = document.querySelector('.gt-hw-machine')?.getAttribute('data-phase');
    const running = [...document.querySelectorAll('.gt-premium-secondary button')].some((button) => button.textContent?.includes('PARAR'));
    return spins >= ${autoBefore + 10} && phase === 'idle' && !running;
  })()`, "Auto 10 completion", 60_000);

  const final = await state(client);
  assertViewport(final, "Auto 10 complete");
  const autoRoundsObserved = final.spins - autoBefore;
  if (autoRoundsObserved !== 10) throw new Error(`AUTO: expected 10 spins, observed ${autoRoundsObserved}`);
  report.auto = { rounds: autoRoundsObserved, totalMs: Date.now() - autoStartedAt };
  report.soundWasDisabledForDeterminism = soundButton;
  report.totalBaseSpins = final.spins;

  if (report.totalBaseSpins !== 30) throw new Error(`Expected 30 total base spins, observed ${report.totalBaseSpins}`);

  await screenshot(client, `${outputDir}/auto-10-complete.png`);
  await writeFile(`${outputDir}/frontend-playtest-report.json`, JSON.stringify(report, null, 2));
  console.log(`✅ Golden Tiger frontend playtest passed: 10 Normal + 10 Turbo + Auto 10 (${report.totalBaseSpins} spins)`);
} finally {
  client.close();
  await closeTarget(target.id);
}
