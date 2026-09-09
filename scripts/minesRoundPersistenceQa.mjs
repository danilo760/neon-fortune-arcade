const appUrl = process.env.MINES_URL ?? "http://127.0.0.1:3000/game/neon-mines";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9225";
const roundKey = "neon-fortune-arcade:mines-round:v1";
const arcadeKey = "lucky-neon-arcade:v1";
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
async function waitFor(client, expression, label, timeout = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(client, expression)) return;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
async function navigate(client, url) {
  await client.send("Page.navigate", { url });
  await waitFor(client, `document.readyState === 'complete'`, `load ${url}`);
  await sleep(350);
}

const target = await createTarget();
const client = new CdpClient(target.webSocketDebuggerUrl);
try {
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844,
  });

  const origin = new URL(appUrl).origin;
  await navigate(client, origin + "/");
  await evaluate(client, `localStorage.removeItem(${JSON.stringify(roundKey)})`);
  await navigate(client, appUrl);
  await waitFor(client, `Boolean(document.querySelector('.mines-premium__cabinet'))`, "Mines mount");
  const initialStatus = await evaluate(client, `document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status')`);
  if (initialStatus !== "idle") throw new Error(`expected clean idle start, got ${initialStatus}`);

  await evaluate(client, `(() => {
    const open = [...document.querySelectorAll('button')].find((button) => button.getAttribute('aria-label')?.startsWith('Abrir cofre apostando'));
    open?.click();
    return Boolean(open);
  })()`);
  await waitFor(client, `Boolean(localStorage.getItem(${JSON.stringify(roundKey)}))`, "persisted round after debit");

  const opened = await evaluate(client, `(() => ({
    round: JSON.parse(localStorage.getItem(${JSON.stringify(roundKey)})),
    arcade: JSON.parse(localStorage.getItem(${JSON.stringify(arcadeKey)})),
    status: document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status'),
  }))()`);
  if (opened.status !== "playing") throw new Error(`round did not start: ${opened.status}`);
  if (!opened.round || opened.round.mineField.length !== opened.round.mineCount) throw new Error("invalid persisted mine field");

  const mines = new Set(opened.round.mineField);
  const safeIndex = Array.from({ length: 25 }, (_, index) => index).find((index) => !mines.has(index));
  if (safeIndex == null) throw new Error("could not find deterministic safe tile from persisted field");

  await evaluate(client, `(() => {
    const button = document.querySelector('[aria-label="Revelar casa ${safeIndex + 1}"]');
    button?.click();
    return Boolean(button);
  })()`);
  await waitFor(client, `(() => {
    const raw = localStorage.getItem(${JSON.stringify(roundKey)});
    if (!raw) return false;
    return JSON.parse(raw).revealed.includes(${safeIndex});
  })()`, "safe reveal persisted");
  await waitFor(client, `document.querySelector('.mines-premium__cabinet')?.getAttribute('data-reveal-phase') === 'idle'`, "safe reveal unlock");

  const beforeLeave = await evaluate(client, `(() => ({
    round: JSON.parse(localStorage.getItem(${JSON.stringify(roundKey)})),
    arcade: JSON.parse(localStorage.getItem(${JSON.stringify(arcadeKey)})),
  }))()`);

  await navigate(client, origin + "/");
  await navigate(client, appUrl);
  await waitFor(client, `document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status') === 'playing'`, "restored playing round");
  await waitFor(client, `document.querySelector('[aria-label="Casa ${safeIndex + 1}, segura"]') !== null`, "restored safe tile");

  const restored = await evaluate(client, `(() => ({
    round: JSON.parse(localStorage.getItem(${JSON.stringify(roundKey)})),
    arcade: JSON.parse(localStorage.getItem(${JSON.stringify(arcadeKey)})),
    status: document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status'),
    cashoutEnabled: [...document.querySelectorAll('button')].some((button) => button.getAttribute('aria-label')?.startsWith('Garantir ganho de') && !button.disabled),
  }))()`);

  if (restored.status !== "playing") throw new Error(`restored status is ${restored.status}`);
  if (JSON.stringify(restored.round) !== JSON.stringify(beforeLeave.round)) throw new Error("round snapshot changed across navigation");
  if (restored.arcade.balance !== beforeLeave.arcade.balance) throw new Error(`balance changed on restore: ${beforeLeave.arcade.balance} -> ${restored.arcade.balance}`);
  if (restored.arcade.totalSpins !== beforeLeave.arcade.totalSpins) throw new Error("restore counted a second wager");
  if (!restored.cashoutEnabled) throw new Error("cashout is not available after restoring a safe reveal");

  await evaluate(client, `(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.getAttribute('aria-label')?.startsWith('Garantir ganho de'));
    button?.click();
    return Boolean(button);
  })()`);
  await waitFor(client, `localStorage.getItem(${JSON.stringify(roundKey)}) === null`, "snapshot clear on cashout");

  console.log(`✅ Mines persistence QA passed | safe=${safeIndex + 1} | balance=${restored.arcade.balance} | revealed=${restored.round.revealed.length}`);
} finally {
  client.close();
  await closeTarget(target.id);
}
