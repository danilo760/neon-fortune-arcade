import { mkdir, writeFile } from "node:fs/promises";

const appUrl = process.env.GOLDEN_TIGER_URL ?? "http://127.0.0.1:3000/game/golden-tiger";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9222";
const outputDir = process.env.GOLDEN_TIGER_QA_DIR ?? "artifacts/golden-tiger";
const viewport = { width: 390, height: 844 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function createTarget() {
  const response = await fetch(`${cdpUrl}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Could not create Chrome target: ${response.status}`);
  return response.json();
}

async function closeTarget(id) {
  await fetch(`${cdpUrl}/json/close/${id}`).catch(() => undefined);
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

async function screenshot(client, path) {
  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(path, Buffer.from(result.data, "base64"));
}

async function waitFor(client, expression, label, timeoutMs = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(client, expression)) return;
    await sleep(14);
  }
  const debug = await evaluate(client, `(() => ({
    phase: document.querySelector('.gt-hw-machine')?.getAttribute('data-phase') ?? null,
    randomCalls: window.__gtQaRandom?.calls ?? null,
    remaining: window.__gtQaRandom?.queue?.length ?? null,
  }))()`);
  throw new Error(`Timed out waiting for ${label}; debug=${JSON.stringify(debug)}`);
}

async function waitForPhase(client, phase, timeoutMs) {
  await waitFor(
    client,
    `document.querySelector('.gt-hw-machine')?.getAttribute('data-phase') === ${JSON.stringify(phase)}`,
    `phase ${phase}`,
    timeoutMs,
  );
}

async function snapshotState(client) {
  return evaluate(client, `(() => {
    const machine = document.querySelector('.gt-hw-machine');
    const overlay = document.querySelector('.gt-hw-win-overlay');
    return {
      phase: machine?.getAttribute('data-phase') ?? null,
      featureActive: document.querySelector('.gt-hw-respin-panel')?.classList.contains('is-active') ?? false,
      locked: document.querySelectorAll('.gt-hw-cell.is-locked').length,
      fresh: document.querySelectorAll('.gt-hw-cell.is-fresh').length,
      blanks: document.querySelectorAll('.gt-hw-cell.is-feature-blank').length,
      rolling: document.querySelectorAll('.gt-hw-cell-motion').length,
      winning: document.querySelectorAll('.gt-hw-cell.is-winning').length,
      overlay: overlay?.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
      overlayFull: overlay?.classList.contains('is-full') ?? false,
      overlayMega: overlay?.classList.contains('is-mega') ?? false,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      randomCalls: window.__gtQaRandom?.calls ?? null,
      randomRemaining: window.__gtQaRandom?.queue?.length ?? null,
    };
  })()`);
}

async function openScenario(name, values, fallback = 0.9) {
  const target = await createTarget();
  const client = new CdpClient(target.webSocketDebuggerUrl);
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

  // Install the wrapper before application modules load. Production bundling
  // may capture Math.random while evaluating a module; capturing this wrapper
  // is fine because the wrapper reads a mutable queue populated only at click.
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const state = { queue: [], fallback: 0.9, calls: 0 };
      Object.defineProperty(window, '__gtQaRandom', { value: state, configurable: true });
      Math.random = () => {
        state.calls += 1;
        return state.queue.length ? state.queue.shift() : state.fallback;
      };
    })();`,
  });

  await client.send("Page.navigate", { url: appUrl });
  await waitFor(client, `Boolean(document.querySelector('.gt-hw-spin:not(:disabled)'))`, `${name} idle mount`);

  await evaluate(client, `(() => {
    window.__gtQaRandom.queue = ${JSON.stringify(values)}.slice();
    window.__gtQaRandom.fallback = ${fallback};
    window.__gtQaRandom.calls = 0;
    document.querySelector('.gt-hw-spin')?.click();
    return true;
  })()`);

  return { target, client };
}

async function closeScenario({ target, client }) {
  client.close();
  await closeTarget(target.id);
}

function requireState(condition, message) {
  if (!condition) throw new Error(message);
}

async function capturePhase(client, scenario, phase, validate, timeoutMs = 12_000) {
  await waitForPhase(client, phase, timeoutMs);
  await sleep(42);
  const state = await snapshotState(client);
  validate(state);
  await screenshot(client, `${outputDir}/special-${scenario}-${phase}.png`);
  return state;
}

await mkdir(outputDir, { recursive: true });
const report = [];

const featureProgressValues = [
  ...Array(9).fill(0.5),
  0,
  0.5,
  0.05, 0.05, 0.05,
  ...Array(6).fill(0.9),
  ...Array(6).fill(0.9),
];

{
  const scenario = await openScenario("feature-progress", featureProgressValues);
  try {
    report.push({ scenario: "feature-progress", state: "intro", data: await capturePhase(
      scenario.client,
      "feature-progress",
      "feature-intro",
      (state) => {
        requireState(state.featureActive, "feature intro did not activate feature panel");
        requireState(state.locked === 0, `feature intro should start empty, got ${state.locked} locked`);
        requireState(state.blanks === 9, `feature intro should show 9 intentional blanks, got ${state.blanks}`);
      },
    ) });

    report.push({ scenario: "feature-progress", state: "spin", data: await capturePhase(
      scenario.client,
      "feature-progress",
      "feature-spin",
      (state) => {
        requireState(state.featureActive, "feature spin lost active state");
        requireState(state.rolling === 9, `first feature respin should animate 9 cells, got ${state.rolling}`);
      },
    ) });

    report.push({ scenario: "feature-progress", state: "lock", data: await capturePhase(
      scenario.client,
      "feature-progress",
      "feature-lock",
      (state) => {
        requireState(state.locked === 3, `feature lock expected 3 sticky cells, got ${state.locked}`);
        requireState(state.fresh === 3, `feature lock expected 3 fresh cells, got ${state.fresh}`);
      },
    ) });

    report.push({ scenario: "feature-progress", state: "miss", data: await capturePhase(
      scenario.client,
      "feature-progress",
      "feature-miss",
      (state) => {
        requireState(state.locked === 3, `feature miss should preserve 3 sticky cells, got ${state.locked}`);
        requireState(state.rolling === 0, `feature miss should stop cell motion, got ${state.rolling}`);
      },
    ) });
  } finally {
    await closeScenario(scenario);
  }
}

const bigWinValues = [
  0, 0, 0,
  0.05, 0.05, 0.05,
  0.5, 0.9, 0.15,
  0.5,
];

{
  const scenario = await openScenario("big-win", bigWinValues);
  try {
    report.push({ scenario: "big-win", state: "win", data: await capturePhase(
      scenario.client,
      "big-win",
      "win",
      (state) => {
        requireState(state.overlay.includes("GRANDE GANHO"), `expected GRANDE GANHO overlay, got ${state.overlay}`);
        requireState(!state.overlayFull, "big win incorrectly marked full-grid");
      },
    ) });
  } finally {
    await closeScenario(scenario);
  }
}

const megaWinValues = [
  0, 0, 0,
  0, 0, 0,
  0.5, 0.9, 0.15,
  0.5,
];

{
  const scenario = await openScenario("mega-win", megaWinValues);
  try {
    report.push({ scenario: "mega-win", state: "win", data: await capturePhase(
      scenario.client,
      "mega-win",
      "win",
      (state) => {
        requireState(state.overlay.includes("MEGA GANHO"), `expected MEGA GANHO overlay, got ${state.overlay}`);
        requireState(state.overlayMega, "mega win overlay missing is-mega state");
        requireState(!state.overlayFull, "mega win incorrectly marked full-grid");
      },
    ) });
  } finally {
    await closeScenario(scenario);
  }
}

const baseFullGridValues = [
  ...Array(9).fill(0),
  0.5,
];

{
  const scenario = await openScenario("base-full-grid", baseFullGridValues);
  try {
    report.push({ scenario: "base-full-grid", state: "full-grid", data: await capturePhase(
      scenario.client,
      "base-full-grid",
      "full-grid",
      (state) => {
        requireState(state.overlay.includes("TELA CHEIA"), `expected TELA CHEIA overlay, got ${state.overlay}`);
        requireState(state.overlayFull, "base full-grid overlay missing is-full state");
        requireState(!state.featureActive, "base full-grid incorrectly kept Fortune Feature active");
        requireState(state.winning === 9, `base full-grid should highlight 9 positions, got ${state.winning}`);
      },
    ) });
  } finally {
    await closeScenario(scenario);
  }
}

const featureFullGridValues = [
  ...Array(9).fill(0.5),
  0,
  0.5,
  ...Array(9).fill(0),
];

{
  const scenario = await openScenario("feature-full-grid", featureFullGridValues, 0);
  try {
    report.push({ scenario: "feature-full-grid", state: "lock", data: await capturePhase(
      scenario.client,
      "feature-full-grid",
      "feature-lock",
      (state) => {
        requireState(state.locked === 9, `feature full-grid lock expected 9 sticky cells, got ${state.locked}`);
        requireState(state.fresh === 9, `feature full-grid expected 9 fresh cells, got ${state.fresh}`);
      },
    ) });

    report.push({ scenario: "feature-full-grid", state: "full-grid", data: await capturePhase(
      scenario.client,
      "feature-full-grid",
      "full-grid",
      (state) => {
        requireState(state.overlay.includes("TELA CHEIA"), `feature full-grid missing TELA CHEIA overlay: ${state.overlay}`);
        requireState(state.overlayFull, "feature full-grid overlay missing is-full state");
        requireState(state.featureActive, "feature full-grid should remain visually inside Fortune Feature until settle completes");
        requireState(state.locked === 9, `feature full-grid should retain 9 sticky cells, got ${state.locked}`);
      },
    ) });
  } finally {
    await closeScenario(scenario);
  }
}

await writeFile(`${outputDir}/special-states-report.json`, JSON.stringify(report, null, 2));
console.log(`✅ Golden Tiger special-state QA passed (${report.length} captured states)`);
