const appUrl = process.env.MINES_URL ?? "http://127.0.0.1:3000/game/neon-mines";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9225";
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
async function closeTarget(id) { await fetch(`${cdpUrl}/json/close/${id}`).catch(() => undefined); }
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
  const cabinet = document.querySelector('.mines-premium__cabinet');
  const grid = document.querySelector('.mines-premium__grid');
  const tiles = [...document.querySelectorAll('.mines-premium__grid .mines-premium__tile')];
  const legacyArt = document.querySelector('.mines-premium__machine-art');
  const open = [...document.querySelectorAll('button')].find((button) => button.getAttribute('aria-label')?.startsWith('Abrir cofre apostando'));
  const rect = (el) => el ? (() => { const r = el.getBoundingClientRect(); return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; })() : null;
  const br = open?.getBoundingClientRect();
  const centerInViewport = Boolean(br && br.top >= 0 && br.bottom <= innerHeight);
  const hit = br && centerInViewport ? document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2) : null;
  return {
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    cabinet: rect(cabinet),
    grid: rect(grid),
    tileCount: tiles.length,
    enabledTiles: tiles.filter((tile) => !tile.disabled).length,
    status: cabinet?.getAttribute('data-round-status') ?? null,
    openPresent: Boolean(open),
    openDisabled: Boolean(open?.disabled),
    openInViewport: centerInViewport,
    openHit: Boolean(open && hit && (hit === open || open.contains(hit))),
    legacyArtPresent: Boolean(legacyArt),
    legacyArtDisplay: legacyArt ? getComputedStyle(legacyArt).display : null,
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
    await sleep(1400);
    await applyViewport(client, viewport);
    await sleep(160);

    const idle = await evaluate(client, auditExpression);
    const errors = [];
    if (idle.scrollWidth > viewport.width + 1) errors.push(`overflow ${idle.scrollWidth}px`);
    if (!idle.cabinet || idle.cabinet.left < -1 || idle.cabinet.right > viewport.width + 1) errors.push("cabinet outside viewport");
    if (idle.tileCount !== 25) errors.push(`expected 25 tiles, got ${idle.tileCount}`);
    if (!idle.openPresent) errors.push("open vault action missing");
    if (idle.openDisabled) errors.push("open vault action disabled on idle load");
    if (idle.legacyArtPresent && idle.legacyArtDisplay !== "none") errors.push(`legacy screenshot is visible (${idle.legacyArtDisplay})`);

    await evaluate(client, `(() => {
      const open = [...document.querySelectorAll('button')].find((button) => button.getAttribute('aria-label')?.startsWith('Abrir cofre apostando'));
      open?.scrollIntoView({ block: 'center', inline: 'nearest' });
      return true;
    })()`);
    await sleep(120);
    const ready = await evaluate(client, auditExpression);
    if (!ready.openInViewport || !ready.openHit) errors.push("open vault action is obscured after scroll");

    await evaluate(client, `(() => { [...document.querySelectorAll('button')].find((button) => button.getAttribute('aria-label')?.startsWith('Abrir cofre apostando'))?.click(); return true; })()`);
    await sleep(180);
    const playing = await evaluate(client, auditExpression);
    if (playing.status !== "playing") errors.push(`expected playing after open, got ${playing.status}`);
    if (playing.enabledTiles < 20) errors.push(`expected playable minefield, got ${playing.enabledTiles} enabled tiles`);

    if (errors.length) {
      failed = true;
      console.error(`❌ ${viewport.width}x${viewport.height}: ${errors.join('; ')}`);
    } else {
      console.log(`✅ ${viewport.width}x${viewport.height}: vector cabinet + scroll-to-action + round start passed | legacy-display=${idle.legacyArtDisplay}`);
    }
  } finally {
    client.close();
    await closeTarget(target.id);
  }
}

if (failed) process.exitCode = 1;
