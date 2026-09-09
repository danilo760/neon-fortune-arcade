import { mkdir, writeFile } from "node:fs/promises";

const appUrl = process.env.OLYMPUS_STORM_URL ?? "http://127.0.0.1:3000/game/olympus-storm";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9223";
const outputDir = process.env.OLYMPUS_STORM_QA_DIR ?? "artifacts/olympus-storm";
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

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

async function applyViewport(client, viewport) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
}

const auditExpression = `(() => {
  const machine = document.querySelector('.osp-machine');
  const grid = document.querySelector('.osp-grid');
  const spin = document.querySelector('.osp-spin');
  const guardian = document.querySelector('.osp-guardian-crest');
  const cells = [...document.querySelectorAll('.osp-grid > .osp-cell')];
  const symbols = [...document.querySelectorAll('.osp-symbol')];
  const vectors = [...document.querySelectorAll('.osp-symbol-svg')];
  const referenceImages = [...document.querySelectorAll('.osp-machine img')];
  const rect = (element) => element ? (() => {
    const r = element.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  })() : null;
  const spinRect = spin?.getBoundingClientRect();
  const hit = spinRect ? document.elementFromPoint(spinRect.left + spinRect.width / 2, spinRect.top + spinRect.height / 2) : null;
  const machineStyle = machine ? getComputedStyle(machine) : null;
  const guardianStyle = guardian ? getComputedStyle(guardian) : null;
  const paintedSymbols = symbols.filter((symbol) => {
    const style = getComputedStyle(symbol);
    return style.backgroundImage.includes('.svg') || style.backgroundImage.includes('image/svg+xml');
  });
  const hiddenLegacyVectors = vectors.filter((vector) => Number(getComputedStyle(vector).opacity) <= .01);
  return {
    ready: Boolean(machine && grid && spin),
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    machine: rect(machine),
    grid: rect(grid),
    spin: rect(spin),
    guardian: rect(guardian),
    spinHit: Boolean(hit && spin && (hit === spin || spin.contains(hit))),
    phase: machine?.getAttribute('data-phase') ?? null,
    cellCount: cells.length,
    vectorCount: vectors.length,
    paintedSymbolCount: paintedSymbols.length,
    hiddenLegacyVectorCount: hiddenLegacyVectors.length,
    referenceImageCount: referenceImages.length,
    spinDisabled: Boolean(spin?.disabled),
    machineBackground: machineStyle?.backgroundImage ?? 'none',
    guardianBackground: guardianStyle?.backgroundImage ?? 'none',
  };
})()`;

async function waitForStableLayout(client, viewport) {
  let lastAudit = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await applyViewport(client, viewport);
    await sleep(attempt === 0 ? 160 : 80);
    lastAudit = await evaluate(client, auditExpression);
    const stable =
      lastAudit?.ready &&
      Math.abs(lastAudit.width - viewport.width) <= 1 &&
      lastAudit.machine?.height > viewport.height * .88 &&
      lastAudit.machine?.height <= viewport.height + 2 &&
      lastAudit.spin?.height > 50 &&
      lastAudit.scrollWidth <= viewport.width + 1;
    if (stable) return lastAudit;
  }
  return lastAudit;
}

function validateIdle(audit, viewport) {
  const errors = [];
  if (!audit?.ready) errors.push("Olympus premium cabinet did not mount");
  if (audit.scrollWidth > viewport.width + 1) errors.push(`horizontal overflow ${audit.scrollWidth}px > ${viewport.width}px`);
  if (!audit.machine || audit.machine.left < -1 || audit.machine.right > viewport.width + 1) errors.push("machine exceeds horizontal viewport");
  if (!audit.machine || audit.machine.top < -1 || audit.machine.bottom > viewport.height + 1) errors.push("machine exceeds vertical viewport");
  if (audit.cellCount !== 30) errors.push(`expected 30 grid cells, got ${audit.cellCount}`);
  if (audit.vectorCount !== 30) errors.push(`expected 30 semantic vector fallbacks on idle grid, got ${audit.vectorCount}`);
  if (audit.paintedSymbolCount !== 30) errors.push(`expected 30 authored painted symbols, got ${audit.paintedSymbolCount}`);
  if (audit.hiddenLegacyVectorCount !== 30) errors.push(`legacy flat glyphs are still visible (${audit.hiddenLegacyVectorCount}/30 hidden)`);
  if (!audit.guardian || audit.guardian.width < 130 || audit.guardian.height < 90) errors.push("Storm Warden guardian is missing/collapsed");
  if (!audit.guardianBackground || (!audit.guardianBackground.includes('.svg') && !audit.guardianBackground.includes('image/svg+xml'))) errors.push("Storm Warden authored SVG is not painted");
  if (audit.referenceImageCount !== 0) errors.push(`reference bitmap is still mounted (${audit.referenceImageCount} image elements)`);
  if (!audit.machineBackground || audit.machineBackground === "none") errors.push("authorial storm background is missing");
  if (!audit.spinHit) errors.push("Spin center is obscured/not hittable");
  if (audit.spinDisabled) errors.push("Spin unexpectedly disabled on idle load");
  return errors;
}

function validateSpin(audit) {
  const errors = [];
  if (audit.phase !== "spin" && audit.phase !== "landing") errors.push(`expected spin/landing after click, got ${audit.phase}`);
  if (!audit.spinDisabled) errors.push("Spin should be disabled while Olympus round is active");
  if (audit.cellCount !== 30) errors.push(`grid changed size during spin: ${audit.cellCount}`);
  if (audit.paintedSymbolCount !== 30) errors.push(`authored symbols disappeared during spin (${audit.paintedSymbolCount}/30)`);
  if (audit.referenceImageCount !== 0) errors.push("reference bitmap appeared during spin");
  return errors;
}

await mkdir(outputDir, { recursive: true });
const report = [];
let failed = false;

for (const viewport of viewports) {
  const target = await createTarget();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  try {
    await client.connect();
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await applyViewport(client, viewport);
    await client.send("Page.navigate", { url: appUrl });
    await sleep(1_250);

    const idle = await waitForStableLayout(client, viewport);
    const idleErrors = validateIdle(idle, viewport);
    await screenshot(client, `${outputDir}/olympus-${viewport.width}x${viewport.height}-idle.png`);

    await evaluate(client, `(() => { document.querySelector('.osp-spin')?.click(); return true; })()`);
    await sleep(150);
    const spinning = await evaluate(client, auditExpression);
    const spinErrors = validateSpin(spinning);
    await screenshot(client, `${outputDir}/olympus-${viewport.width}x${viewport.height}-spin.png`);

    const errors = [...idleErrors, ...spinErrors];
    if (errors.length) failed = true;
    report.push({ viewport, idle, spinning, errors });
  } finally {
    client.close();
    await closeTarget(target.id);
  }
}

await writeFile(`${outputDir}/report.json`, JSON.stringify(report, null, 2));
for (const item of report) {
  const label = `${item.viewport.width}x${item.viewport.height}`;
  if (item.errors.length) console.error(`❌ ${label}: ${item.errors.join("; ")}`);
  else console.log(`✅ ${label}: authored Storm Warden + 30 painted symbols + spin passed`);
}
if (failed) process.exitCode = 1;