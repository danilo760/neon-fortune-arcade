const APP = process.env.GOLDEN_TIGER_URL ?? "http://127.0.0.1:3000/game/golden-tiger";
const CDP = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9222";
const STORAGE = "lucky-neon-arcade:v1";
const BUY_MULTIPLIER = 31;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };

const target = await (await fetch(`${CDP}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })).json();
let seq = 0;
const pending = new Map();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", () => reject(new Error("CDP websocket error")), { once: true });
});
socket.addEventListener("message", (event) => {
  const msg = JSON.parse(String(event.data));
  const p = msg.id && pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evalJs = async (expression) => {
  const out = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (out.exceptionDetails) throw new Error(JSON.stringify(out.exceptionDetails));
  return out.result?.value;
};
const waitFor = async (expression, label, timeout = 30_000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evalJs(expression)) return;
    await sleep(30);
  }
  const debug = await evalJs(`(() => ({
    phase: document.querySelector('.gt-hw-machine')?.dataset.phase ?? null,
    featurePurchased: document.querySelector('.gt-hw-machine')?.dataset.featurePurchased ?? null,
    featureMode: document.querySelector('.gt-hw-machine')?.dataset.featureMode ?? null,
    rngCalls: window.__gtQaRandom?.calls ?? null,
    rngRemaining: window.__gtQaRandom?.queue?.length ?? null,
  }))()`);
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(debug)}`);
};

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 });
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const state = { queue: [], fallback: 0.9, calls: 0 };
      Object.defineProperty(window, '__gtQaRandom', { value: state, configurable: true });
      Math.random = () => {
        state.calls += 1;
        return state.queue.length ? state.queue.shift() : state.fallback;
      };
    })();`,
  });
  await send("Page.navigate", { url: APP });
  await waitFor("document.readyState === 'complete'", "load");
  await waitFor("document.querySelector('.gt-hw-machine')?.dataset.phase === 'idle'", "idle");

  const before = await evalJs(`JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE)}) || '{}').balance`);
  assert(Number.isFinite(before), "initial balance unavailable");
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.includes('COMPRAR BÔNUS')); b?.click(); return Boolean(b); })()`);
  await waitFor("Boolean(document.querySelector('.gt-premium-bonus-modal'))", "bonus modal");
  const modal = await evalJs(`document.querySelector('.gt-premium-bonus-modal')?.textContent?.replace(/\\s+/g,' ').trim() ?? ''`);
  assert(modal.includes("CUSTO"), `bonus modal missing CUSTO: ${modal}`);
  assert(modal.includes("COMPRAR BÔNUS"), "bonus modal confirmation missing");

  await evalJs(`(() => {
    window.__gtQaRandom.queue = [0.9, ...Array(9).fill(0.9)];
    window.__gtQaRandom.fallback = 0.9;
    window.__gtQaRandom.calls = 0;
    const b=[...document.querySelectorAll('.gt-premium-bonus-modal button')].find(x=>x.textContent?.includes('COMPRAR BÔNUS'));
    b?.click();
    return Boolean(b);
  })()`);
  await waitFor("document.querySelector('.gt-hw-machine')?.dataset.featurePurchased === 'true'", "purchased marker");
  await waitFor("document.querySelector('.gt-hw-machine')?.dataset.featureMode === 'active'", "active feature");
  const active = await evalJs(`(() => { const s=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE)})||'{}'); return { balance:s.balance, title:document.querySelector('.gt-premium-feature-title')?.textContent?.replace(/\\s+/g,' ').trim()??'' }; })()`);
  const expectedCost = 20 * BUY_MULTIPLIER;
  assert(active.balance === before - expectedCost, `bonus debit mismatch: before=${before} active=${active.balance}`);
  assert(active.title.includes("RODADA BÔNUS"), "bonus intro title missing");

  await waitFor("document.querySelector('.gt-hw-machine')?.dataset.phase === 'idle'", "settlement");
  const settled = await evalJs(`(() => { const s=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE)})||'{}'); return { balance:s.balance, entry:s.history?.[0]??null }; })()`);
  assert(settled.entry, "bonus history entry missing");
  assert(settled.entry.bet === expectedCost, `history stake mismatch: ${settled.entry.bet}`);
  assert(String(settled.entry.note || '').includes('COMPRA Fortune Feature'), "purchase note missing");
  assert(settled.balance === before - expectedCost + settled.entry.payout, "settled balance mismatch");
  console.log(`✅ Golden bonus purchase QA passed | cost=${expectedCost} payout=${settled.entry.payout}`);
} finally {
  socket.close();
  await fetch(`${CDP}/json/close/${target.id}`).catch(() => undefined);
}
