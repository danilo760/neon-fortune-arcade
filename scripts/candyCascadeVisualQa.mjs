import { mkdir, writeFile } from "node:fs/promises";

const appUrl = process.env.CANDY_CASCADE_URL ?? "http://127.0.0.1:3000/game/candy-cascade";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9224";
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];
const artifactDir = "artifacts/candy-cascade";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CdpClient {
  constructor(url) {
    this.url = url;
    this.id = 0;
    this.pending = new Map();
  }
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

async function capture(client, viewport, state) {
  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const path = `${artifactDir}/candy-${viewport.width}x${viewport.height}-${state}.png`;
  await writeFile(path, Buffer.from(result.data, "base64"));
  return path;
}

const auditExpression = `(() => {
  const machine = document.querySelector('.ccp-machine');
  const grid = document.querySelector('.ccp-grid');
  const spin = document.querySelector('[aria-label="Girar Candy Cascade"]');
  const mascot = document.querySelector('.ccp-mascot-core');
  const cells = [...document.querySelectorAll('.ccp-grid > .ccp-cell')];
  const symbols = [...document.querySelectorAll('.ccp-grid .ccp-symbol')];
  const svgSymbols = [...document.querySelectorAll('.ccp-grid .ccp-symbol-svg')];
  const images = document.querySelectorAll('.ccp-machine img');
  const paintedSymbols = symbols.filter((symbol) => {
    const style = getComputedStyle(symbol);
    return style.backgroundImage.includes('.svg') || style.backgroundImage.includes('image/svg+xml');
  });
  const hiddenLegacyVectors = svgSymbols.filter((vector) => Number(getComputedStyle(vector).opacity) <= .01);
  const rect = (el) => el ? (() => { const r = el.getBoundingClientRect(); return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; })() : null;
  const sr = spin?.getBoundingClientRect();
  const hit = sr ? document.elementFromPoint(sr.left + sr.width/2, sr.top + sr.height/2) : null;
  const mascotStyle = mascot ? getComputedStyle(mascot) : null;
  return {
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    machine: rect(machine),
    grid: rect(grid),
    spin: rect(spin),
    mascot: rect(mascot),
    mascotBackground: mascotStyle?.backgroundImage ?? 'none',
    spinHit: Boolean(spin && hit && (hit === spin || spin.contains(hit))),
    spinDisabled: Boolean(spin?.disabled),
    phase: machine?.getAttribute('data-phase') ?? null,
    cellCount: cells.length,
    svgSymbolCount: svgSymbols.length,
    paintedSymbolCount: paintedSymbols.length,
    hiddenLegacyVectorCount: hiddenLegacyVectors.length,
    imageCount: images.length,
  };
})()`;

await mkdir(artifactDir, { recursive: true });
let failed = false;
const report = [];
for (const viewport of viewports) {
  const target = await createTarget();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  try {
    await client.connect();
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await applyViewport(client, viewport);
    await client.send("Page.navigate", { url: appUrl });
    await sleep(1300);
    await applyViewport(client, viewport);
    await sleep(180);

    const idle = await evaluate(client, auditExpression);
    const errors = [];
    if (idle.scrollWidth > viewport.width + 1) errors.push(`overflow ${idle.scrollWidth}px`);
    if (!idle.machine || idle.machine.left < -1 || idle.machine.right > viewport.width + 1) errors.push("cabinet outside viewport");
    if (!idle.machine || idle.machine.bottom > viewport.height + 1) errors.push("cabinet exceeds vertical viewport");
    if (idle.cellCount !== 30) errors.push(`expected 30 cells, got ${idle.cellCount}`);
    if (idle.paintedSymbolCount !== 30) errors.push(`expected 30 authored painted symbols, got ${idle.paintedSymbolCount}`);
    if (idle.svgSymbolCount < 25) errors.push(`semantic vector fallback coverage too low: ${idle.svgSymbolCount}`);
    if (idle.hiddenLegacyVectorCount !== idle.svgSymbolCount) errors.push(`legacy flat glyphs are still visible (${idle.hiddenLegacyVectorCount}/${idle.svgSymbolCount} hidden)`);
    if (!idle.mascot || idle.mascot.width < 100 || idle.mascot.height < 80) errors.push("Sugar Sprite mascot is missing/collapsed");
    if (!idle.mascotBackground || (!idle.mascotBackground.includes('.svg') && !idle.mascotBackground.includes('image/svg+xml'))) errors.push("authorial Sugar Sprite SVG is not painted");
    if (idle.imageCount !== 0) errors.push(`reference images still mounted: ${idle.imageCount}`);
    if (!idle.spinHit) errors.push("spin not hittable");
    if (idle.spinDisabled) errors.push("spin disabled on idle load");
    const idleShot = await capture(client, viewport, "idle");

    await evaluate(client, `(() => { document.querySelector('[aria-label="Girar Candy Cascade"]')?.click(); return true; })()`);
    await sleep(120);
    const active = await evaluate(client, auditExpression);
    if (!["spin", "landing", "anticipation"].includes(active.phase)) errors.push(`unexpected phase after spin: ${active.phase}`);
    if (!active.spinDisabled) errors.push("spin should disable during round");
    if (active.paintedSymbolCount !== 30) errors.push(`authored symbols disappeared during spin (${active.paintedSymbolCount}/30)`);
    const spinShot = await capture(client, viewport, "spin");

    report.push({ viewport, idle, active, errors, screenshots: [idleShot, spinShot] });
    if (errors.length) {
      failed = true;
      console.error(`❌ ${viewport.width}x${viewport.height}: ${errors.join('; ')}`);
    } else {
      console.log(`✅ ${viewport.width}x${viewport.height}: Sugar Sprite + 30 painted symbols + spin passed`);
    }
  } finally {
    client.close();
    await closeTarget(target.id);
  }
}

await writeFile(`${artifactDir}/report.json`, JSON.stringify(report, null, 2));
if (failed) process.exitCode = 1;