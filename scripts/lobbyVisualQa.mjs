const appUrl = process.env.LOBBY_URL ?? "http://127.0.0.1:3000/";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9227";
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];
const expectedPlayable = ["golden-tiger", "olympus-storm", "candy-cascade", "neon-mines", "neon-plinko"];
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
async function applyViewport(client, viewport) {
  await client.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: true, screenWidth: viewport.width, screenHeight: viewport.height });
  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
}

const auditExpression = `(() => {
  const lobby = document.querySelector('.arcade-lobby');
  const hero = document.querySelector('.fortune-hero');
  const search = document.querySelector('input[aria-label="Buscar jogo"]');
  const cards = [...document.querySelectorAll('.game-card')];
  const playableLinks = [...document.querySelectorAll('a[href^="/game/"]')].map((a) => a.getAttribute('href')).filter(Boolean);
  const originals = document.querySelectorAll('.game-cover-original').length;
  const legacyPlayableCovers = document.querySelectorAll('.game-cover-reference--olympus, .game-cover-reference--candy, .game-cover-reference--mines, .game-cover-reference--plinko').length;
  const tigerCta = [...document.querySelectorAll('a[href="/game/golden-tiger"]')].find((a) => a.textContent?.includes('JOGAR AGORA'));
  const lobbyText = lobby?.textContent ?? '';
  return {
    ready: Boolean(lobby && hero && search),
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    cardCount: cards.length,
    playableLinks: [...new Set(playableLinks)],
    originals,
    legacyPlayableCovers,
    tigerCta: Boolean(tigerCta),
    hasStaleFreeSpinCopy: /giros grátis/i.test(lobbyText),
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

    const audit = await evaluate(client, auditExpression);
    const errors = [];
    if (!audit.ready) errors.push("lobby did not mount");
    if (audit.scrollWidth > viewport.width + 1) errors.push(`horizontal overflow ${audit.scrollWidth}px`);
    if (!audit.tigerCta) errors.push("Golden Tiger primary CTA missing");
    if (audit.originals < 4) errors.push(`expected original covers for non-Tiger games, got ${audit.originals}`);
    if (audit.legacyPlayableCovers !== 0) errors.push(`${audit.legacyPlayableCovers} legacy playable cover(s) still active`);
    for (const slug of expectedPlayable) {
      if (!audit.playableLinks.includes(`/game/${slug}`)) errors.push(`missing playable link /game/${slug}`);
    }
    if (audit.hasStaleFreeSpinCopy) errors.push("lobby still advertises old Golden Tiger free-spins copy");

    if (errors.length) {
      failed = true;
      console.error(`❌ ${viewport.width}x${viewport.height}: ${errors.join('; ')}`);
    } else {
      console.log(`✅ ${viewport.width}x${viewport.height}: lobby links + original covers + no overflow passed`);
    }
  } finally {
    client.close();
    await closeTarget(target.id);
  }
}
if (failed) process.exitCode = 1;
