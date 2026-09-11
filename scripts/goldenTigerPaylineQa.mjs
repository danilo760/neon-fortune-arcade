import { mkdir, writeFile } from "node:fs/promises";

const appUrl = process.env.GOLDEN_TIGER_URL ?? "http://127.0.0.1:3000/game/golden-tiger";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9222";
const outputDir = process.env.GOLDEN_TIGER_QA_DIR ?? "artifacts/golden-tiger/paylines";
const viewport = { width: 390, height: 844 };
const expectedLabels = ["LINHA 1", "LINHA 2", "LINHA 3", "LINHA 4", "LINHA 5"];

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

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(`Browser evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
  return result.result?.value;
}

async function waitFor(client, expression, label, timeoutMs = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(client, expression)) return;
    await sleep(18);
  }
  throw new Error(`Timed out waiting for ${label}`);
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

await mkdir(outputDir, { recursive: true });
const target = await createTarget();
const client = new CdpClient(target.webSocketDebuggerUrl);
const observed = [];

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
      const state = { queue: [], fallback: 0.9, calls: 0 };
      Object.defineProperty(window, '__gtQaRandom', { value: state, configurable: true });
      Math.random = () => {
        state.calls += 1;
        return state.queue.length ? state.queue.shift() : state.fallback;
      };
    })();`,
  });

  await client.send("Page.navigate", { url: appUrl });
  await waitFor(client, `document.readyState === 'complete'`, "document load");
  await waitFor(client, `Boolean(document.querySelector('.gt-hw-spin:not(:disabled)'))`, "spin button");
  await sleep(420);
  await waitFor(client, `document.querySelector('.gt-hw-machine')?.getAttribute('data-phase') === 'idle'`, "hydrated idle");

  // Nine zeroes force the same base symbol into every cell, which makes all
  // five fixed paylines win. The final value keeps Fortune Feature disabled.
  await evaluate(client, `(() => {
    window.__gtQaRandom.queue = [...Array(9).fill(0), 0.5];
    window.__gtQaRandom.fallback = 0.9;
    window.__gtQaRandom.calls = 0;
    document.querySelector('.gt-hw-spin')?.click();
    return true;
  })()`);

  await waitFor(client, `Boolean(document.querySelector('.gt-rework-payline-stage'))`, "first payline beat", 12_000);

  const deadline = Date.now() + 5_000;
  let lastLabel = "";
  while (Date.now() < deadline && observed.length < expectedLabels.length) {
    const state = await evaluate(client, `(() => {
      const stage = document.querySelector('.gt-rework-payline-stage');
      const label = stage?.querySelector('span')?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const line = stage?.querySelector('polyline')?.getAttribute('points') ?? '';
      return {
        label,
        line,
        focus: document.querySelectorAll('.gt-hw-cell.is-payline-focus').length,
        muted: document.querySelectorAll('.gt-hw-cell.is-payline-muted').length,
        phase: document.querySelector('.gt-hw-machine')?.getAttribute('data-phase') ?? null,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      };
    })()`);

    if (state.label && state.label !== lastLabel) {
      if (state.focus !== 3) throw new Error(`${state.label}: expected 3 focused cells, got ${state.focus}`);
      if (state.muted !== 6) throw new Error(`${state.label}: expected 6 muted cells, got ${state.muted}`);
      if (!state.line) throw new Error(`${state.label}: missing SVG payline points`);
      if (state.phase !== "reveal") throw new Error(`${state.label}: expected reveal phase, got ${state.phase}`);
      if (state.scrollWidth !== viewport.width || state.scrollHeight !== viewport.height) {
        throw new Error(`${state.label}: viewport overflow ${state.scrollWidth}x${state.scrollHeight}`);
      }

      observed.push(state);
      lastLabel = state.label;
      await screenshot(client, `${outputDir}/payline-${String(observed.length).padStart(2, "0")}.png`);
    }

    await sleep(16);
  }

  if (observed.length !== expectedLabels.length) {
    throw new Error(`Expected 5 sequential paylines, observed ${observed.length}: ${observed.map((item) => item.label).join(" | ")}`);
  }

  expectedLabels.forEach((label, index) => {
    if (!observed[index]?.label.startsWith(label)) {
      throw new Error(`Expected ${label} at beat ${index + 1}, got ${observed[index]?.label ?? "missing"}`);
    }
  });

  await waitFor(client, `document.querySelector('.gt-hw-machine')?.getAttribute('data-phase') === 'full-grid'`, "full-grid celebration", 12_000);
  await writeFile(`${outputDir}/payline-report.json`, JSON.stringify({ viewport, observed }, null, 2));
  console.log(`✅ Golden Tiger payline QA passed (${observed.length} sequential lines at ${viewport.width}x${viewport.height})`);
} finally {
  client.close();
  await closeTarget(target.id);
}
