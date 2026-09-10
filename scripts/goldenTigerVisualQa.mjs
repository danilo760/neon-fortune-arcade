import { mkdir, writeFile } from "node:fs/promises";

const appUrl = process.env.GOLDEN_TIGER_URL ?? "http://127.0.0.1:3000/game/golden-tiger";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9222";
const outputDir = process.env.GOLDEN_TIGER_QA_DIR ?? "artifacts/golden-tiger";
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

const auditExpression = `(async () => {
  const machine = document.querySelector('.gt-hw-machine');
  const grid = document.querySelector('.gt-hw-grid');
  const spin = document.querySelector('.gt-hw-spin');
  const sprite = document.querySelector('.gt-hw-tiger-sprite');
  const cells = [...document.querySelectorAll('.gt-hw-grid > .gt-hw-cell')];
  const rasters = [...document.querySelectorAll('.gt-hw-symbol-raster')];
  const cylinders = [...document.querySelectorAll('.gt-commercial-reel-cylinder')];
  const rect = (element) => element ? (() => {
    const r = element.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  })() : null;
  const spinRect = spin?.getBoundingClientRect();
  const hit = spinRect ? document.elementFromPoint(spinRect.left + spinRect.width / 2, spinRect.top + spinRect.height / 2) : null;

  const spriteBackground = sprite ? getComputedStyle(sprite).backgroundImage : 'none';
  const match = spriteBackground.match(/^url\\(["']?(.*?)["']?\\)$/);
  let spriteDecoded = false;
  let spriteNaturalWidth = 0;
  let spriteNaturalHeight = 0;
  let spriteFirstCellVisiblePixels = 0;
  let spriteDecodeError = null;

  if (match?.[1]) {
    try {
      const image = new Image();
      image.src = match[1];
      await image.decode();
      spriteDecoded = image.naturalWidth > 0 && image.naturalHeight > 0;
      spriteNaturalWidth = image.naturalWidth;
      spriteNaturalHeight = image.naturalHeight;

      if (spriteDecoded) {
        const cellWidth = Math.max(1, Math.floor(image.naturalWidth / 4));
        const cellHeight = Math.max(1, Math.floor(image.naturalHeight / 2));
        const canvas = document.createElement('canvas');
        canvas.width = cellWidth;
        canvas.height = cellHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context?.drawImage(image, 0, 0, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
        const pixels = context?.getImageData(0, 0, cellWidth, cellHeight).data;
        if (pixels) {
          for (let index = 3; index < pixels.length; index += 4) {
            if (pixels[index] > 20) spriteFirstCellVisiblePixels += 1;
          }
        }
      }
    } catch (error) {
      spriteDecodeError = String(error?.message ?? error);
    }
  }

  const rasterPaintedCount = rasters.filter((raster) => {
    const style = getComputedStyle(raster);
    const background = style.backgroundImage || '';
    const r = raster.getBoundingClientRect();
    return background !== 'none' && background.includes('premium-symbol-atlas') && r.width > 8 && r.height > 8;
  }).length;

  return {
    ready: Boolean(machine && grid && spin && sprite),
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    machine: rect(machine),
    grid: rect(grid),
    spin: rect(spin),
    sprite: rect(sprite),
    spinHit: Boolean(hit && spin && (hit === spin || spin.contains(hit))),
    cellCount: cells.length,
    reelCylinders: cylinders.length,
    continuousSurface: grid?.getAttribute('data-reel-surface') ?? null,
    decoratedCells: cells.filter((cell) => { const style = getComputedStyle(cell); return style.backgroundImage !== 'none' || parseFloat(style.borderTopWidth) > 0 || parseFloat(style.borderRightWidth) > 0 || parseFloat(style.borderBottomWidth) > 0 || parseFloat(style.borderLeftWidth) > 0 || parseFloat(style.borderRadius) > 0; }).length,
    rasterSymbolCount: rasters.length,
    rasterPaintedCount,
    spriteBackground,
    spriteDecoded,
    spriteNaturalWidth,
    spriteNaturalHeight,
    spriteFirstCellVisiblePixels,
    spriteDecodeError,
    phase: machine?.getAttribute('data-phase') ?? null,
    reelOverlays: document.querySelectorAll('.gt-hw-reel-overlay').length,
    spinDisabled: Boolean(spin?.disabled),
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
      lastAudit.machine?.height > viewport.height * 0.8 &&
      lastAudit.machine?.height <= viewport.height + 2 &&
      lastAudit.spin?.height > 30 &&
      lastAudit.scrollWidth <= viewport.width + 1;
    if (stable) return lastAudit;
  }
  return lastAudit;
}

function validateIdle(audit, viewport) {
  const errors = [];
  if (!audit?.ready) errors.push("Golden Tiger cabinet did not mount");
  if (audit.scrollWidth > viewport.width + 1) errors.push(`horizontal overflow ${audit.scrollWidth}px > ${viewport.width}px`);
  if (!audit.machine || audit.machine.left < -1 || audit.machine.right > viewport.width + 1) errors.push("machine exceeds horizontal viewport");
  if (!audit.machine || audit.machine.top < -1 || audit.machine.bottom > viewport.height + 1) errors.push("machine exceeds vertical viewport");
  if (audit.cellCount !== 9) errors.push(`expected 9 reel cells, got ${audit.cellCount}`);
  if (audit.reelCylinders !== 3) errors.push(`expected 3 continuous reel cylinders, got ${audit.reelCylinders}`);
  if (audit.continuousSurface !== 'continuous') errors.push(`continuous reel surface marker missing: ${audit.continuousSurface}`);
  if (audit.decoratedCells !== 0) errors.push(`expected zero individually decorated reel cells, got ${audit.decoratedCells}`);
  if (audit.rasterSymbolCount < 9) errors.push(`expected at least 9 raster symbol surfaces, got ${audit.rasterSymbolCount}`);
  if (audit.rasterPaintedCount < 9) errors.push(`expected at least 9 painted raster symbols, got ${audit.rasterPaintedCount}`);
  if (!audit.spriteBackground || audit.spriteBackground === "none") errors.push("tiger pose atlas is not applied");
  if (!audit.spriteDecoded) errors.push(`tiger pose atlas failed to decode: ${audit.spriteDecodeError ?? "unknown"}`);
  if (audit.spriteDecoded && audit.spriteFirstCellVisiblePixels < 1_000) errors.push(`tiger idle atlas cell appears empty: ${audit.spriteFirstCellVisiblePixels} visible pixels`);
  if (!audit.spinHit) errors.push("Spin center is obscured/not hittable");
  if (audit.spinDisabled) errors.push("Spin unexpectedly disabled on idle load");
  return errors;
}

function validateSpin(audit) {
  const errors = [];
  if (audit.phase !== "base-spin") errors.push(`expected base-spin after click, got ${audit.phase}`);
  if (audit.reelOverlays !== 3) errors.push(`expected 3 moving reel overlays, got ${audit.reelOverlays}`);
  if (!audit.spinDisabled) errors.push("Spin should be disabled while a round is active");
  if (!audit.spriteDecoded) errors.push("tiger pose atlas stopped decoding during spin");
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
    await screenshot(client, `${outputDir}/golden-${viewport.width}x${viewport.height}-idle.png`);

    await evaluate(client, `(() => { document.querySelector('.gt-hw-spin')?.click(); return true; })()`);
    await sleep(140);
    const spinning = await evaluate(client, auditExpression);
    const spinErrors = validateSpin(spinning);
    await screenshot(client, `${outputDir}/golden-${viewport.width}x${viewport.height}-spin.png`);

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
  else console.log(`✅ ${label}: raster symbols + idle + spin visual smoke passed`);
}

if (failed) process.exitCode = 1;
