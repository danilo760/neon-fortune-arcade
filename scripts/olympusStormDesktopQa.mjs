import { mkdir, writeFile } from "node:fs/promises";

const appUrl = process.env.OLYMPUS_STORM_URL ?? "http://127.0.0.1:3000/game/olympus-storm";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9223";
const outputDir = "artifacts/olympus-storm";
const viewport = { width: 1363, height: 936 };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CdpClient {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP websocket timeout")), 8000);
      this.socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener("error", () => reject(new Error("CDP websocket error")), { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.socket?.close(); }
}

async function createTarget() {
  const response = await fetch(`${cdpUrl}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Could not create target: ${response.status}`);
  return response.json();
}

async function closeTarget(id) {
  await fetch(`${cdpUrl}/json/close/${id}`).catch(() => undefined);
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

async function screenshot(client, path) {
  const result = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(path, Buffer.from(result.data, "base64"));
}

const auditExpression = `(() => {
  const selectors = {
    machine: '.osp-machine',
    topbar: '.osp-topbar',
    guardian: '.osp-guardian-crest',
    stageHud: '.osp-stage-hud',
    grid: '.osp-grid',
    status: '.osp-status',
    economy: '.osp-economy',
    controls: '.osp-controls',
  };
  const rect = (element) => {
    if (!element) return null;
    const r = element.getBoundingClientRect();
    return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
  };
  const visible = (element) => {
    if (!element) return false;
    const style = getComputedStyle(element);
    const r = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .02 && r.width > 2 && r.height > 2;
  };
  const sections = Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
    const element = document.querySelector(selector);
    return [name, { rect: rect(element), visible: visible(element) }];
  }));
  const machine = document.querySelector('.osp-machine');
  const symbols = [...document.querySelectorAll('.osp-symbol')];
  const paintedSymbols = symbols.filter((symbol) => {
    const style = getComputedStyle(symbol);
    return style.backgroundImage.includes('.svg') || style.backgroundImage.includes('image/svg+xml');
  });
  const guardian = document.querySelector('.osp-guardian-crest');
  const spin = document.querySelector('.osp-spin');
  return {
    viewport: { width: innerWidth, height: innerHeight },
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    phase: machine?.getAttribute('data-phase') ?? null,
    sections,
    cellCount: document.querySelectorAll('.osp-grid > .osp-cell').length,
    paintedSymbolCount: paintedSymbols.length,
    guardianBackground: guardian ? getComputedStyle(guardian).backgroundImage : 'none',
    spinDisabled: Boolean(spin?.disabled),
  };
})()`;

function validate(audit, label) {
  const errors = [];
  if (!audit || audit.viewport.width !== viewport.width || audit.viewport.height !== viewport.height) errors.push(`viewport mismatch at ${label}`);
  if (audit.scrollWidth > viewport.width + 1) errors.push(`horizontal overflow ${audit.scrollWidth}px at ${label}`);
  if (audit.cellCount !== 30) errors.push(`expected 30 cells, got ${audit.cellCount} at ${label}`);
  if (audit.paintedSymbolCount !== 30) errors.push(`expected 30 authored symbols, got ${audit.paintedSymbolCount} at ${label}`);
  if (!audit.guardianBackground?.includes('.svg') && !audit.guardianBackground?.includes('image/svg+xml')) errors.push(`Storm Warden SVG missing at ${label}`);

  const machine = audit.sections?.machine?.rect;
  if (!machine || !audit.sections.machine.visible) errors.push(`machine missing at ${label}`);
  if (machine && (machine.left < -1 || machine.right > viewport.width + 1 || machine.top < -1 || machine.bottom > viewport.height + 1)) errors.push(`machine outside desktop viewport at ${label}`);

  for (const [name, state] of Object.entries(audit.sections ?? {})) {
    if (!state?.visible) errors.push(`${name} disappeared at ${label}`);
    const r = state?.rect;
    if (!r || !machine || name === 'machine') continue;
    if (r.left < machine.left - 3 || r.right > machine.right + 3 || r.top < machine.top - 3 || r.bottom > machine.bottom + 3) errors.push(`${name} escaped cabinet at ${label}`);
  }
  return errors;
}

await mkdir(outputDir, { recursive: true });
const target = await createTarget();
const client = new CdpClient(target.webSocketDebuggerUrl);
let failed = false;
const report = [];

try {
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  await client.send("Emulation.setEmulatedMedia", { media: "screen", features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await client.send("Page.navigate", { url: appUrl });
  await sleep(1400);

  const idle = await evaluate(client, auditExpression);
  const idleErrors = validate(idle, "idle");
  if (idle.spinDisabled) idleErrors.push("spin disabled on desktop idle");
  await screenshot(client, `${outputDir}/olympus-1363x936-idle.png`);
  report.push({ state: "idle", audit: idle, errors: idleErrors });

  await evaluate(client, `(() => { document.querySelector('.osp-spin')?.click(); return true; })()`);
  await sleep(160);
  const spin = await evaluate(client, auditExpression);
  const spinErrors = validate(spin, "spin");
  if (!["spin", "landing"].includes(spin.phase)) spinErrors.push(`unexpected phase ${spin.phase} after spin click`);
  if (!spin.spinDisabled) spinErrors.push("spin should be disabled during active round");
  await screenshot(client, `${outputDir}/olympus-1363x936-spin.png`);
  report.push({ state: "spin", audit: spin, errors: spinErrors });

  failed = report.some((sample) => sample.errors.length > 0);
} finally {
  client.close();
  await closeTarget(target.id);
}

await writeFile(`${outputDir}/desktop-report.json`, JSON.stringify({ viewport, report }, null, 2));
for (const sample of report) {
  if (sample.errors.length) console.error(`❌ desktop ${sample.state}: ${sample.errors.join('; ')}`);
  else console.log(`✅ desktop ${sample.state}: Storm Warden + 30 authored symbols + HUD/controls intact`);
}
if (failed) process.exitCode = 1;