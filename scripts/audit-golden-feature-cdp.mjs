const BASE = "http://127.0.0.1:9223";
const APP = process.env.APP_URL ?? "http://127.0.0.1:4174/game/golden-tiger";

class CdpClient {
  constructor(url) { this.ws = new WebSocket(url); this.nextId = 1; this.pending = new Map(); this.listeners = new Map(); }
  async ready() {
    if (this.ws.readyState !== WebSocket.OPEN) await new Promise((resolve, reject) => { this.ws.addEventListener("open", resolve, { once: true }); this.ws.addEventListener("error", reject, { once: true }); });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) { const pending = this.pending.get(message.id); if (!pending) return; this.pending.delete(message.id); if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result); return; }
      const queue = this.listeners.get(message.method); if (queue?.length) queue.shift()(message.params);
    });
  }
  send(method, params = {}) { const id = this.nextId++; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  once(method) { return new Promise((resolve) => { const queue = this.listeners.get(method) ?? []; queue.push(resolve); this.listeners.set(method, queue); }); }
  close() { this.ws.close(); }
}

async function evaluate(cdp, expression) { const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "Runtime.evaluate failed"); return result.result?.value; }
async function waitFor(cdp, expression, timeoutMs = 180000) { const start = Date.now(); while (Date.now() - start < timeoutMs) { if (await evaluate(cdp, expression)) return; await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error(`Timed out waiting for: ${expression}`); }

const target = await fetch(`${BASE}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" }).then((r) => r.json());
const cdp = new CdpClient(target.webSocketDebuggerUrl);
await cdp.ready();
await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
  let a = 0x2f6e2b1;
  Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try {
    const key = 'lucky-neon-arcade:v1';
    if (location.origin !== 'null' && !localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify({ balance: 1000000, favorites: [], soundEnabled: false, history: [], totalSpins: 0, bestWin: 0 }));
    }
  } catch {}
})();` });
const loaded = cdp.once("Page.loadEventFired"); await cdp.send("Page.navigate", { url: APP }); await loaded;
await waitFor(cdp, `Boolean(document.querySelector('button[aria-label="Abrir Golden Fortune Bonus Buy"]'))`, 30000);
await waitFor(cdp, `!document.querySelector('button[aria-label="Abrir Golden Fortune Bonus Buy"]')?.disabled`, 30000);
await evaluate(cdp, `document.querySelector('button[aria-label="Alternar turbo"]')?.click()`);
await waitFor(cdp, `document.querySelector('button[aria-label="Alternar turbo"]')?.getAttribute('aria-pressed') === 'true'`, 10000);

const initial = await evaluate(cdp, `(() => { const s = JSON.parse(localStorage.getItem('lucky-neon-arcade:v1') || '{}'); return { balance: s.balance, totalSpins: s.totalSpins ?? 0, history: s.history?.length ?? 0 }; })()`);
if (!Number.isFinite(initial.balance)) throw new Error(`Audit state was not seeded: ${JSON.stringify(initial)}`);
await evaluate(cdp, `document.querySelector('button[aria-label="Abrir Golden Fortune Bonus Buy"]')?.click()`);
await waitFor(cdp, `Boolean(document.querySelector('[role="dialog"]'))`, 10000);
const modal = await evaluate(cdp, `(() => { const el = document.querySelector('[role="dialog"]'); const text = el?.textContent ?? ''; const rect = el?.getBoundingClientRect(); return { text, viewportWidth: innerWidth, docWidth: document.documentElement.scrollWidth, rect: rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null, activateDisabled: document.querySelector('[role="dialog"] button:last-child')?.disabled ?? true }; })()`);
if (!modal.text.includes('GOLDEN FORTUNE') || !modal.text.includes('8 FREE SPINS') || !modal.text.includes('MOEDAS FICTÍCIAS')) throw new Error(`Feature modal copy missing: ${JSON.stringify(modal)}`);
if (modal.docWidth > modal.viewportWidth + 1 || !modal.rect || modal.rect.left < -1 || modal.rect.right > modal.viewportWidth + 1) throw new Error(`Mobile overflow: ${JSON.stringify(modal)}`);
if (modal.activateDisabled) throw new Error('Feature activate unexpectedly disabled');

await evaluate(cdp, `(() => {
  window.__featurePerf = { start: performance.now(), frames: 0, deltas: [], longTasks: [], maxNodes: 0 };
  window.__featurePerfStop = false;
  let last = performance.now();
  const observer = new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__featurePerf.longTasks.push(e.duration); });
  try { observer.observe({ entryTypes: ['longtask'] }); } catch {}
  window.__featureObserver = observer;
  const tick = (now) => { if (window.__featurePerfStop) return; const d = now-last; if (d>0 && d<1000) window.__featurePerf.deltas.push(d); window.__featurePerf.frames += 1; window.__featurePerf.maxNodes = Math.max(window.__featurePerf.maxNodes, document.querySelectorAll('*').length); last=now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const button = document.querySelector('[role="dialog"] button:last-child');
  button?.click();
  button?.click();
  return true;
})()`);

await waitFor(cdp, `!document.querySelector('[role="dialog"]')`, 10000);
await waitFor(cdp, `(() => { const s = JSON.parse(localStorage.getItem('lucky-neon-arcade:v1') || '{}'); return s.balance === ${initial.balance} - 2900; })()`, 10000);
const afterDebit = await evaluate(cdp, `JSON.parse(localStorage.getItem('lucky-neon-arcade:v1') || '{}')`);
if (afterDebit.totalSpins !== initial.totalSpins) throw new Error(`Feature buy counted as normal spin: ${afterDebit.totalSpins}`);

await waitFor(cdp, `Boolean(document.querySelector('.gt-ref-bonus-mode')) || document.querySelector('.gt-ref-feature-running')?.getAttribute('data-feature-stage') === '6'`, 30000);
await waitFor(cdp, `(() => { const s = JSON.parse(localStorage.getItem('lucky-neon-arcade:v1') || '{}'); return !document.querySelector('.gt-ref-bonus-mode') && (s.history ?? []).some((e) => (e.note ?? '').includes('Compra de Bônus · Golden Fortune')); })()`, 180000);
await new Promise((resolve) => setTimeout(resolve, 250));

const final = await evaluate(cdp, `(() => {
  window.__featurePerfStop = true; window.__featureObserver?.disconnect?.();
  const p = window.__featurePerf; const elapsed = performance.now() - p.start; const sorted = p.deltas.filter(v => v > 0).sort((a,b)=>a-b); const worst = sorted.at(-1) ?? 0; const p99 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length*.99))] : 0;
  const s = JSON.parse(localStorage.getItem('lucky-neon-arcade:v1') || '{}');
  const purchases = (s.history ?? []).filter(e => (e.note ?? '').includes('Compra de Bônus · Golden Fortune'));
  const purchase = purchases[0];
  return { balance:s.balance, totalSpins:s.totalSpins ?? 0, purchases:purchases.length, purchase, historyCount:s.history?.length ?? 0, avgFps: elapsed>0 ? p.frames/(elapsed/1000):0, worstFrameMs:worst, p99FrameMs:p99, longTasks:p.longTasks.length, maxLongTaskMs:p.longTasks.length?Math.max(...p.longTasks):0, maxDomNodes:p.maxNodes, docWidth:document.documentElement.scrollWidth, viewportWidth:innerWidth };
})()`);

if (final.purchases !== 1) throw new Error(`Expected exactly one purchase history entry: ${JSON.stringify(final)}`);
if (final.totalSpins !== initial.totalSpins) throw new Error(`Purchased free spins debited/count as normal spins: ${JSON.stringify(final)}`);
if (final.balance !== initial.balance - 2900 + Math.round(final.purchase?.payout ?? 0)) throw new Error(`Settlement mismatch: ${JSON.stringify({initial,final})}`);
if (final.docWidth > final.viewportWidth + 1) throw new Error(`Post-feature mobile overflow: ${JSON.stringify(final)}`);
if (final.avgFps < 20 || final.worstFrameMs > 400 || final.maxDomNodes > 900) throw new Error(`Feature presentation performance gate failed: ${JSON.stringify(final)}`);
console.log(JSON.stringify({ initial, modal, final }, null, 2));
cdp.close();
