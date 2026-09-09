const appUrl = process.env.GOLDEN_TIGER_URL ?? "http://127.0.0.1:3000/game/golden-tiger";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9222";
const storageKey = "lucky-neon-arcade:v1";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CdpClient {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.socket = null; }
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
      if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.socket.send(JSON.stringify({ id, method, params })); });
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
async function waitFor(client, expression, label, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(client, expression)) return;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
function assert(condition, message) { if (!condition) throw new Error(message); }

const target = await createTarget();
const client = new CdpClient(target.webSocketDebuggerUrl);
try {
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 });
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const original = Math.random;
      window.__gtBonusQaOriginalRandom = original;
      window.__gtBonusQaForceMiss = false;
      Math.random = () => window.__gtBonusQaForceMiss ? 0.9 : original();
    })();`,
  });
  await client.send("Page.navigate", { url: appUrl });
  await waitFor(client, `document.readyState === 'complete'`, "document load");
  await waitFor(client, `document.querySelector('.gt-hw-machine')?.getAttribute('data-phase') === 'idle'`, "idle renderer");
  await sleep(350);

  const initial = await evaluate(client, `(() => {
    const state = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}');
    const bonus = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('BÔNUS'));
    return { balance: state.balance, bonusPresent: Boolean(bonus), bonusDisabled: Boolean(bonus?.disabled) };
  })()`);
  assert(Number.isFinite(initial.balance), "initial arcade balance unavailable");
  assert(initial.bonusPresent, "premium BÔNUS control missing");
  assert(!initial.bonusDisabled, "premium BÔNUS control unexpectedly disabled");

  await evaluate(client, `(() => { [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('BÔNUS'))?.click(); return true; })()`);
  await waitFor(client, `Boolean(document.querySelector('.gt-premium-bonus-modal'))`, "bonus purchase modal");
  const modal = await evaluate(client, `(() => ({ text: document.querySelector('.gt-premium-bonus-modal')?.textContent?.replace(/\\s+/g,' ').trim() ?? '' }))()`);
  assert(modal.text.includes("100×"), `bonus modal does not expose 100× price: ${modal.text}`);
  assert(modal.text.includes("ATIVAR FEATURE"), "bonus modal confirmation missing");

  await evaluate(client, `(() => {
    window.__gtBonusQaForceMiss = true;
    [...document.querySelectorAll('.gt-premium-bonus-modal button')].find((button) => button.textContent?.includes('ATIVAR FEATURE'))?.click();
    return true;
  })()`);

  await waitFor(client, `document.querySelector('.gt-hw-machine')?.getAttribute('data-feature-purchased') === 'true'`, "purchased feature state");
  await waitFor(client, `document.querySelector('.gt-hw-machine')?.getAttribute('data-feature-mode') === 'active'`, "active feature mode");
  const active = await evaluate(client, `(() => {
    const state = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}');
    const machine = document.querySelector('.gt-hw-machine');
    return {
      balance: state.balance,
      phase: machine?.getAttribute('data-phase'),
      purchased: machine?.getAttribute('data-feature-purchased'),
      featureTitle: document.querySelector('.gt-premium-feature-title')?.textContent?.replace(/\\s+/g,' ').trim() ?? '',
    };
  })()`);
  const expectedCost = 20 * 100;
  assert(active.balance === initial.balance - expectedCost, `bonus debit mismatch: before=${initial.balance} active=${active.balance} expectedCost=${expectedCost}`);
  assert(active.purchased === "true", "purchased feature marker missing");
  assert(active.featureTitle.includes("FORTUNE FEATURE"), "feature intro title missing");

  await waitFor(client, `document.querySelector('.gt-hw-machine')?.getAttribute('data-phase') === 'idle'`, "bonus settlement", 25000);
  const settled = await evaluate(client, `(() => {
    const state = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}');
    const entry = state.history?.[0] ?? null;
    return { balance: state.balance, entry };
  })()`);
  assert(settled.entry, "bonus purchase history entry missing");
  assert(settled.entry.bet === expectedCost, `history should record purchased stake ${expectedCost}, got ${settled.entry.bet}`);
  assert(String(settled.entry.note || '').includes('COMPRA Fortune Feature'), `history note does not identify bonus purchase: ${settled.entry.note}`);
  assert(settled.balance === initial.balance - expectedCost + settled.entry.payout, `settled balance mismatch: ${settled.balance}`);
  console.log(`✅ Golden bonus purchase: modal -> ${expectedCost} debit -> active feature -> single settlement passed | payout=${settled.entry.payout}`);
} finally {
  client.close();
  await closeTarget(target.id);
}
