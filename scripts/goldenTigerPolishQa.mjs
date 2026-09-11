import { mkdir, writeFile } from "node:fs/promises";

const appUrl = process.env.GOLDEN_TIGER_URL ?? "http://127.0.0.1:3000/game/golden-tiger";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9222";
const outputDir = process.env.GOLDEN_TIGER_POLISH_QA_DIR ?? "artifacts/golden-tiger/polish";
const viewport = { width: 390, height: 844 };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CdpClient {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.socket = null; }
  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP websocket timeout")), 8_000);
      this.socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP websocket error")); }, { once: true });
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
  close() { this.socket?.close(); }
}

async function createTarget() {
  const response = await fetch(`${cdpUrl}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Could not create Chrome target: ${response.status}`);
  return response.json();
}
async function closeTarget(id) { await fetch(`${cdpUrl}/json/close/${id}`).catch(() => undefined); }
async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(`Browser evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
  return result.result?.value;
}
async function waitFor(client, expression, label, timeoutMs = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(client, expression)) return;
    await sleep(16);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
async function screenshot(client, name) {
  const result = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(`${outputDir}/${name}.png`, Buffer.from(result.data, "base64"));
}
function requireState(condition, message) { if (!condition) throw new Error(message); }

async function openTarget(initSource) {
  const target = await createTarget();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: true,
    screenWidth: viewport.width, screenHeight: viewport.height,
  });
  if (initSource) await client.send("Page.addScriptToEvaluateOnNewDocument", { source: initSource });
  await client.send("Page.navigate", { url: appUrl });
  await waitFor(client, `document.readyState === 'complete'`, "document load");
  await waitFor(client, `document.querySelector('.gt-hw-machine')?.getAttribute('data-phase') === 'idle'`, "idle mount");
  await sleep(420);
  return { target, client };
}

async function openSpinScenario(values, fallback = 0.9) {
  const source = `(() => {
    const state = { queue: [], fallback: ${fallback}, calls: 0 };
    window.__gtPolishRandom = state;
    Math.random = () => { state.calls += 1; return state.queue.length ? state.queue.shift() : state.fallback; };
  })();`;
  const scenario = await openTarget(source);
  await evaluate(scenario.client, `(() => {
    window.__gtPolishRandom.queue = ${JSON.stringify(values)}.slice();
    document.querySelector('.gt-hw-spin')?.click();
    return true;
  })()`);
  await waitFor(scenario.client, `document.querySelector('.gt-hw-machine')?.getAttribute('data-phase') !== 'idle'`, "spin start");
  return scenario;
}

async function closeScenario({ target, client }) { client.close(); await closeTarget(target.id); }

await mkdir(outputDir, { recursive: true });
const report = [];

// Big win guarantees the existing engine requests anticipation before reel 3.
{
  const scenario = await openSpinScenario([0,0,0, 0.05,0.05,0.05, 0.5,0.9,0.15, 0.5]);
  try {
    await waitFor(scenario.client, `document.querySelector('.gt-hw-machine')?.getAttribute('data-anticipating') === 'true'`, "anticipation takeover");
    await waitFor(
      scenario.client,
      `(() => {
        const hud = document.querySelector('.gt-hw-hud');
        return hud && Number.parseFloat(getComputedStyle(hud).opacity) <= 0.82;
      })()`,
      "anticipation HUD transition",
      1_000,
    );
    await sleep(24);
    const state = await evaluate(scenario.client, `(() => {
      const scene = document.querySelector('.gt-commercial-scene');
      const track = document.querySelector('.gt-hw-reel-overlay:not(.is-braking) .gt-hw-reel-track') ?? document.querySelector('.gt-hw-reel-overlay .gt-hw-reel-track');
      const hud = document.querySelector('.gt-hw-hud');
      return {
        anticipating: document.querySelector('.gt-hw-machine')?.getAttribute('data-anticipating'),
        sceneFilter: scene ? getComputedStyle(scene).filter : 'none',
        reelFilter: track ? getComputedStyle(track).filter : 'none',
        hudOpacity: hud ? getComputedStyle(hud).opacity : '1',
      };
    })()`);
    requireState(state.anticipating === "true", "anticipation attribute missing");
    requireState(state.sceneFilter !== "none", `scene was not dimmed: ${state.sceneFilter}`);
    requireState(state.reelFilter.includes("blur"), `last reel severe blur missing: ${state.reelFilter}`);
    requireState(Number(state.hudOpacity) < 1, `HUD was not de-emphasized: ${state.hudOpacity}`);
    await screenshot(scenario.client, "anticipation-takeover");
    report.push({ scenario: "anticipation", ...state });
  } finally { await closeScenario(scenario); }
}

// Mega win must enter celebrate with the new lower-origin parabolic shower.
{
  const scenario = await openSpinScenario([0,0,0, 0,0,0, 0.5,0.9,0.15, 0.5]);
  try {
    await waitFor(scenario.client, `document.querySelector('.gt-commercial-win.is-mega')?.getAttribute('data-win-beat') === 'celebrate'`, "mega celebrate", 14_000);
    await sleep(72);
    const state = await evaluate(scenario.client, `(() => {
      const stage = document.querySelector('.gt-commercial-win.is-mega .gt-commercial-win__particles');
      const particle = stage?.querySelector('img');
      return {
        particleCount: stage?.querySelectorAll('img').length ?? 0,
        animationName: particle ? getComputedStyle(particle).animationName : 'none',
        stageBottom: stage ? getComputedStyle(stage).bottom : null,
      };
    })()`);
    requireState(state.particleCount >= 24, `expected >=24 particles, got ${state.particleCount}`);
    requireState(state.animationName.includes("gt-polish-coin-parabola"), `parabolic animation missing: ${state.animationName}`);
    requireState(state.stageBottom !== "auto", `particle origin was not moved toward Spin control: ${state.stageBottom}`);
    await screenshot(scenario.client, "mega-celebrate-parabola");
    report.push({ scenario: "mega-celebrate", ...state });
  } finally { await closeScenario(scenario); }
}

// 0.9 makes the 4–7s timer resolve to 6.7s and selects the authored look break.
{
  const scenario = await openTarget(`Math.random = () => 0.9;`);
  try {
    await waitFor(scenario.client, `document.querySelector('.gt-hw-tiger-stage')?.getAttribute('data-idle-break') === 'look'`, "tiger idle look break", 8_500);
    const state = await evaluate(scenario.client, `(() => ({
      idleBreak: document.querySelector('.gt-hw-tiger-stage')?.getAttribute('data-idle-break'),
      pose: document.querySelector('.gt-hw-tiger-rig')?.getAttribute('data-pose'),
      transition: document.querySelector('.gt-hw-tiger-stage')?.getAttribute('data-pose-transition'),
    }))()`);
    requireState(state.idleBreak === "look", `expected idle look, got ${state.idleBreak}`);
    requireState(state.pose === "watch", `idle look did not use watch pose: ${state.pose}`);
    await screenshot(scenario.client, "idle-break-look");
    report.push({ scenario: "idle-break", ...state });
  } finally { await closeScenario(scenario); }
}

await writeFile(`${outputDir}/polish-report.json`, JSON.stringify(report, null, 2));
console.log(`✅ Golden Tiger polish QA passed (${report.length} targeted states)`);