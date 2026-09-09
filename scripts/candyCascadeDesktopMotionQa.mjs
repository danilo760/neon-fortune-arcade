import { mkdir, writeFile } from "node:fs/promises";

const appUrl = process.env.CANDY_CASCADE_URL ?? "http://127.0.0.1:3000/game/candy-cascade";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9224";
const outputDir = "artifacts/candy-cascade";
const viewport = { width: 1363, height: 936 };
const sampleDelays = [120, 180, 220, 260, 320, 380, 460];
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
async function closeTarget(id) { await fetch(`${cdpUrl}/json/close/${id}`).catch(() => undefined); }
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
  const machine = document.querySelector('.ccp-machine');
  const grid = document.querySelector('.ccp-grid');
  const selectors = {
    topbar: '.ccp-topbar',
    mascot: '.ccp-mascot',
    sugarHud: '.ccp-sugar-hud',
    grid: '.ccp-grid',
    status: '.ccp-status',
    economy: '.ccp-economy',
    controls: '.ccp-controls',
    footer: '.ccp-machine footer',
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
  const centerHit = (element) => {
    if (!element) return false;
    const r = element.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit) return false;
    if (hit === element || element.contains(hit)) return true;
    return Boolean(hit.closest?.('.ccp-callout, .ccp-big-win, .ccp-cinematic, .ccp-modal'));
  };
  const sections = Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
    const element = document.querySelector(selector);
    return [name, {
      rect: rect(element),
      visible: visible(element),
      centerHit: centerHit(element),
      display: element ? getComputedStyle(element).display : null,
      visibility: element ? getComputedStyle(element).visibility : null,
      opacity: element ? getComputedStyle(element).opacity : null,
    }];
  }));
  const cells = [...document.querySelectorAll('.ccp-grid > .ccp-cell')];
  const cellRects = cells.map(rect);
  const rolling = document.querySelectorAll('.ccp-cell.is-rolling').length;
  const overlays = document.querySelectorAll('.ccp-callout, .ccp-big-win, .ccp-cinematic, .ccp-modal').length;
  return {
    viewport: { width: innerWidth, height: innerHeight },
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    phase: machine?.getAttribute('data-phase') ?? null,
    machine: rect(machine),
    machineVisible: visible(machine),
    machineOverflow: machine ? getComputedStyle(machine).overflow : null,
    grid: rect(grid),
    sections,
    cellCount: cells.length,
    cellRects,
    rolling,
    overlays,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  };
})()`;

function validate(audit, index) {
  const errors = [];
  if (!audit?.machine || !audit.machineVisible) return ["Candy cabinet is not visibly rendered"];
  if (audit.reducedMotion) errors.push("desktop Candy QA unexpectedly uses reduced motion");
  if (audit.viewport.width !== viewport.width || audit.viewport.height !== viewport.height) errors.push(`viewport mismatch ${audit.viewport.width}x${audit.viewport.height}`);
  if (audit.scrollWidth > viewport.width + 1) errors.push(`horizontal overflow ${audit.scrollWidth}px`);
  if (audit.cellCount !== 30) errors.push(`expected 30 cells, got ${audit.cellCount}`);

  const m = audit.machine;
  for (const [name, state] of Object.entries(audit.sections ?? {})) {
    if (!state?.visible) errors.push(`${name} disappeared at sample ${index}`);
    const r = state?.rect;
    if (!r) continue;
    if (r.left < m.left - 2 || r.right > m.right + 2) errors.push(`${name} clipped horizontally at sample ${index}`);
    if (r.top < m.top - 2 || r.bottom > m.bottom + 2) errors.push(`${name} clipped vertically at sample ${index}`);
    if (name !== 'mascot' && name !== 'footer' && !state.centerHit) errors.push(`${name} center is obscured at sample ${index}`);
  }

  for (const [cellIndex, r] of (audit.cellRects ?? []).entries()) {
    if (!r || r.width < 20 || r.height < 20) errors.push(`cell ${cellIndex + 1} collapsed at sample ${index}`);
    if (r && audit.grid && (r.left < audit.grid.left - 2 || r.right > audit.grid.right + 2 || r.top < audit.grid.top - 2 || r.bottom > audit.grid.bottom + 2)) {
      errors.push(`cell ${cellIndex + 1} escaped grid at sample ${index}`);
    }
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
    width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false,
    screenWidth: viewport.width, screenHeight: viewport.height,
  });
  await client.send("Emulation.setEmulatedMedia", {
    media: "screen",
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await client.send("Page.navigate", { url: appUrl });
  await sleep(1100);
  const ready = await evaluate(client, `Boolean(document.querySelector('[aria-label="Girar Candy Cascade"]:not(:disabled)'))`);
  if (!ready) throw new Error("Candy Cascade did not become ready for desktop motion QA");
  await evaluate(client, `(() => { document.querySelector('[aria-label="Girar Candy Cascade"]')?.click(); return true; })()`);

  let elapsed = 0;
  for (let index = 0; index < sampleDelays.length; index += 1) {
    await sleep(sampleDelays[index]);
    elapsed += sampleDelays[index];
    const audit = await evaluate(client, auditExpression);
    const errors = validate(audit, index);
    if (errors.length) failed = true;
    samples.push({ index, elapsed, audit, errors });
    await screenshot(client, `${outputDir}/desktop-motion-${String(index + 1).padStart(2, '0')}-${elapsed}ms.png`);
  }
} finally {
  client.close();
  await closeTarget(target.id);
}

await writeFile(`${outputDir}/desktop-motion-report.json`, JSON.stringify({ viewport, samples }, null, 2));
for (const sample of samples) {
  const label = `${sample.elapsed}ms phase=${sample.audit?.phase ?? 'unknown'} rolling=${sample.audit?.rolling ?? 'n/a'} overlays=${sample.audit?.overlays ?? 'n/a'}`;
  if (sample.errors.length) console.error(`❌ ${label}: ${sample.errors.join('; ')}`);
  else console.log(`✅ ${label}: cabinet + HUD + economy + controls intact`);
}
if (failed) process.exitCode = 1;
