const appUrl = process.env.PLINKO_URL ?? "http://127.0.0.1:3000/game/neon-plinko";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9226";
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
  await sleep(320);
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
  await client.send("Emulation.setEmulatedMedia", {
    media: "screen",
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });

  const origin = new URL(appUrl).origin;
  await navigate(client, origin + "/");
  await evaluate(client, `localStorage.removeItem(${JSON.stringify(arcadeKey)})`);
  await navigate(client, appUrl);
  await waitFor(client, `Boolean(document.querySelector('.plinko-ref-drop:not(:disabled)'))`, "Plinko ready");

  const initialBalance = await evaluate(client, `(() => {
    const hud = [...document.querySelectorAll('.plinko-ref-hud > div')].find((item) => item.querySelector('small')?.textContent?.trim() === 'SALDO');
    const text = hud?.querySelector('strong')?.textContent ?? '';
    return Number(text.replace(/[^0-9-]/g, ''));
  })()`);
  if (!Number.isFinite(initialBalance) || initialBalance <= 0) throw new Error(`could not read initial HUD balance: ${initialBalance}`);

  const selected = await evaluate(client, `(() => {
    const button = [...document.querySelectorAll('.plinko-ref-panel--balls button')].find((item) => item.textContent?.trim() === '5');
    button?.click();
    return Boolean(button);
  })()`);
  if (!selected) throw new Error("could not select 5 balls");
  await waitFor(client, `[...document.querySelectorAll('.plinko-ref-panel--balls button')].some((item) => item.textContent?.trim() === '5' && item.getAttribute('aria-pressed') === 'true')`, "5-ball selection");

  const launched = await evaluate(client, `(() => { const button = document.querySelector('.plinko-ref-drop:not(:disabled)'); button?.click(); return Boolean(button); })()`);
  if (!launched) throw new Error("could not launch Plinko multiball");
  await waitFor(client, `document.querySelector('.plinko-ref-drop')?.getAttribute('aria-busy') === 'true'`, "Plinko busy state");

  const startedAt = Date.now();
  const labels = new Set();
  let sawBusy = false;
  while (Date.now() - startedAt < 5000) {
    const state = await evaluate(client, `(() => ({
      busy: document.querySelector('.plinko-ref-drop')?.getAttribute('aria-busy') === 'true',
      status: document.querySelector('.plinko-ref-status span')?.textContent?.trim() ?? '',
      detail: document.querySelector('.plinko-ref-drop small')?.textContent?.trim() ?? '',
    }))()`);
    if (state.busy) sawBusy = true;
    if (state.status) labels.add(state.status);
    if (/^0\s+EM\s+QUEDA$/i.test(state.status) || /^0\s+em\s+queda$/i.test(state.detail)) {
      throw new Error(`invalid zero-in-flight presentation: ${state.status} / ${state.detail}`);
    }
    if (sawBusy && !state.busy) break;
    await sleep(20);
  }

  const elapsed = Date.now() - startedAt;
  const done = await evaluate(client, `document.querySelector('.plinko-ref-drop')?.getAttribute('aria-busy') !== 'true'`);
  if (!done) throw new Error(`5-ball run did not return idle within 5s (elapsed ${elapsed}ms)`);
  if (elapsed > 3500) throw new Error(`5-ball presentation exceeded 3.5s budget: ${elapsed}ms`);

  const final = await evaluate(client, `JSON.parse(localStorage.getItem(${JSON.stringify(arcadeKey)}))`);
  if (!final) throw new Error("arcade store was not persisted after Plinko settlements");
  const history = Array.isArray(final.history) ? final.history : [];
  const plinkoRounds = history.filter((entry) => entry?.slug === 'neon-plinko');
  if (final.totalSpins !== 5) throw new Error(`expected 5 debits from clean store, got totalSpins=${final.totalSpins}`);
  if (plinkoRounds.length !== 5) throw new Error(`expected exactly 5 Plinko settlements, got ${plinkoRounds.length}`);

  const expectedBalance = initialBalance + plinkoRounds.reduce((sum, entry) => sum - Number(entry.bet || 0) + Number(entry.payout || 0), 0);
  if (final.balance !== expectedBalance) throw new Error(`balance mismatch after 5 settlements: expected ${expectedBalance}, got ${final.balance}`);

  const seen = [...labels];
  if (!seen.some((label) => label.includes("PREPARANDO"))) throw new Error(`missing prepare status: ${seen.join(' | ')}`);
  if (!seen.some((label) => label.includes("EM QUEDA"))) throw new Error(`missing active fall status: ${seen.join(' | ')}`);

  console.log(`✅ Plinko multiball QA passed | elapsed=${elapsed}ms | settlements=${plinkoRounds.length} | states=${seen.join(' > ')}`);
} finally {
  client.close();
  await closeTarget(target.id);
}
