import { mkdir, writeFile } from "node:fs/promises";

const appUrl = process.env.GOLDEN_TIGER_URL ?? "http://127.0.0.1:3000/game/golden-tiger";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9222";
const outputDir = process.env.GOLDEN_TIGER_QA_DIR ?? "artifacts/golden-tiger";
const viewport = { width: 1363, height: 936 };
const sampleDelays = [180, 180, 200, 250, 250, 300];

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
      this.socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("CDP websocket error"));
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

const auditExpression = `(() => {
  const q = (selector) => document.querySelector(selector);
  const machine = q('.gt-hw-machine');
  const grid = q('.gt-hw-grid');
  const sections = {
    topbar: q('.gt-hw-topbar'),
    tiger: q('.gt-hw-tiger-stage'),
    respin: q('.gt-hw-respin-panel'),
    grid,
    status: q('.gt-hw-status'),
    hud: q('.gt-hw-hud'),
    controls: q('.gt-hw-controls'),
  };
  const rect = (element) => {
    if (!element) return null;
    const r = element.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const visible = (element) => {
    if (!element) return false;
    const style = getComputedStyle(element);
    const r = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .02 && r.width > 2 && r.height > 2;
  };
  const machineRect = rect(machine);
  const sectionState = Object.fromEntries(Object.entries(sections).map(([name, element]) => [name, {
    rect: rect(element),
    visible: visible(element),
    display: element ? getComputedStyle(element).display : null,
    overflow: element ? getComputedStyle(element).overflow : null,
  }]));
  const cells = [...document.querySelectorAll('.gt-hw-grid > .gt-hw-cell')];
  const overlays = [...document.querySelectorAll('.gt-hw-reel-overlay')];
  const columns = [];
  if (grid) {
    const r = grid.getBoundingClientRect();
    for (let column = 0; column < 3; column += 1) {
      const x = r.left + r.width * ((column + .5) / 3);
      const y = r.top + r.height * .5;
      const hit = document.elementFromPoint(x, y);
      const reel = hit?.closest?.('.gt-hw-reel-overlay');
      const cell = hit?.closest?.('.gt-hw-cell');
      const winOverlay = hit?.closest?.('.gt-hw-win-overlay');
      columns.push({
        column,
        x,
        y,
        hitClass: hit?.className ?? null,
        reelVisible: Boolean(reel),
        cellVisible: Boolean(cell),
        winOverlayVisible: Boolean(winOverlay),
        coveredByGameSurface: Boolean(reel || cell || winOverlay),
      });
    }
  }
  return {
    viewport: { width: innerWidth, height: innerHeight },
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    phase: machine?.getAttribute('data-phase') ?? null,
    machine: machineRect,
    machineOverflow: machine ? getComputedStyle(machine).overflow : null,
    reelOverlays: overlays.length,
    overlayRects: overlays.map(rect),
    cellCount: cells.length,
    cellRects: cells.map(rect),
    sections: sectionState,
    columns,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  };
})()`;

function validate(audit, index) {
  const errors = [];
  if (!audit?.machine) return ["Golden Tiger cabinet did not mount"];
  if (audit.reducedMotion) errors.push("desktop spin audit unexpectedly uses reduced motion");
  if (audit.viewport.width !== viewport.width || audit.viewport.height !== viewport.height) {
    errors.push(`viewport mismatch ${audit.viewport.width}x${audit.viewport.height}`);
  }
  if (audit.scrollWidth > viewport.width + 1) errors.push(`horizontal overflow ${audit.scrollWidth}px`);
  if (audit.cellCount !== 9) errors.push(`expected 9 cells, got ${audit.cellCount}`);

  for (const [name, state] of Object.entries(audit.sections ?? {})) {
    if (!state?.visible) errors.push(`${name} is not visibly rendered at sample ${index}`);
    const r = state?.rect;
    const m = audit.machine;
    if (r && m) {
      if (r.left < m.left - 2 || r.right > m.right + 2) errors.push(`${name} clipped horizontally at sample ${index}`);
      if (r.top < m.top - 2 || r.bottom > m.bottom + 2) errors.push(`${name} clipped vertically at sample ${index}`);
    }
  }

  for (const column of audit.columns ?? []) {
    if (!column.coveredByGameSurface) errors.push(`column ${column.column + 1} center is blank/obscured at sample ${index}`);
  }

  for (const [cellIndex, r] of (audit.cellRects ?? []).entries()) {
    if (!r || r.width < 20 || r.height < 20) errors.push(`cell ${cellIndex + 1} collapsed at sample ${index}`);
  }
  return errors;
}

await mkdir(outputDir, { recursive: true });
const target = await createTarget();
const client = new CdpClient(target.webSocketDebuggerUrl);
const samples = [];
let failed = false;

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
  await client.send("Emulation.setEmulatedMedia", {
    media: "screen",
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await client.send("Page.navigate", { url: appUrl });
  await sleep(1_250);

  const ready = await evaluate(client, `Boolean(document.querySelector('.gt-hw-spin') && document.querySelector('.gt-hw-grid'))`);
  if (!ready) throw new Error("Golden Tiger did not become ready for desktop spin audit");

  await evaluate(client, `(() => { document.querySelector('.gt-hw-spin')?.click(); return true; })()`);

  let elapsed = 0;
  for (let index = 0; index < sampleDelays.length; index += 1) {
    const delay = sampleDelays[index];
    await sleep(delay);
    elapsed += delay;
    const audit = await evaluate(client, auditExpression);
    const errors = validate(audit, index);
    if (errors.length) failed = true;
    samples.push({ index, elapsed, audit, errors });
    await screenshot(client, `${outputDir}/golden-1363x936-spin-${String(index + 1).padStart(2, '0')}-${elapsed}ms.png`);
  }
} finally {
  client.close();
  await closeTarget(target.id);
}

await writeFile(`${outputDir}/desktop-spin-report.json`, JSON.stringify({ viewport, samples }, null, 2));

for (const sample of samples) {
  const label = `${sample.elapsed}ms · phase=${sample.audit?.phase ?? 'unknown'} · overlays=${sample.audit?.reelOverlays ?? 'n/a'}`;
  if (sample.errors.length) console.error(`❌ ${label}: ${sample.errors.join('; ')}`);
  else console.log(`✅ ${label}: cabinet + HUD + 3 reel columns visible`);
}

if (failed) process.exitCode = 1;