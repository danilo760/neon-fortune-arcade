const appUrl = process.env.CANDY_CASCADE_URL ?? "http://127.0.0.1:3000/game/candy-cascade";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9224";
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

const auditExpression = `(() => {
  const machine = document.querySelector('.cc-machine');
  const grid = document.querySelector('.cc-grid');
  const spin = document.querySelector('[aria-label="Girar Candy Cascade"]');
  const cells = document.querySelectorAll('.cc-grid > .cc-cell');
  const cropImages = document.querySelectorAll('.cc-grid img');
  const cabinetImages = [...document.querySelectorAll('.cc-machine > img')];
  const rect = (el) => el ? (() => { const r = el.getBoundingClientRect(); return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; })() : null;
  const sr = spin?.getBoundingClientRect();
  const hit = sr ? document.elementFromPoint(sr.left + sr.width/2, sr.top + sr.height/2) : null;
  return {
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    machine: rect(machine),
    grid: rect(grid),
    spin: rect(spin),
    spinHit: Boolean(spin && hit && (hit === spin || spin.contains(hit))),
    spinDisabled: Boolean(spin?.disabled),
    phase: machine?.getAttribute('data-phase') ?? null,
    cellCount: cells.length,
    cropImageCount: cropImages.length,
    cabinetImageCount: cabinetImages.length,
  };
})()`;

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
    await sleep(1300);
    await applyViewport(client, viewport);
    await sleep(180);

    const idle = await evaluate(client, auditExpression);
    const errors = [];
    if (idle.scrollWidth > viewport.width + 1) errors.push(`overflow ${idle.scrollWidth}px`);
    if (!idle.machine || idle.machine.left < -1 || idle.machine.right > viewport.width + 1) errors.push("cabinet outside viewport");
    if (idle.cellCount !== 30) errors.push(`expected 30 cells, got ${idle.cellCount}`);
    if (!idle.spinHit) errors.push("spin not hittable");
    if (idle.spinDisabled) errors.push("spin disabled on idle load");

    await evaluate(client, `(() => { document.querySelector('[aria-label="Girar Candy Cascade"]')?.click(); return true; })()`);
    await sleep(120);
    const active = await evaluate(client, auditExpression);
    if (!["spinning", "landing"].includes(active.phase)) errors.push(`unexpected phase after spin: ${active.phase}`);
    if (!active.spinDisabled) errors.push("spin should disable during round");

    if (errors.length) {
      failed = true;
      console.error(`❌ ${viewport.width}x${viewport.height}: ${errors.join('; ')}`);
    } else {
      console.log(`✅ ${viewport.width}x${viewport.height}: layout + spin passed | reference-crops=${idle.cropImageCount} cabinet-images=${idle.cabinetImageCount}`);
    }
  } finally {
    client.close();
    await closeTarget(target.id);
  }
}

if (failed) process.exitCode = 1;
