const BASE = "http://127.0.0.1:9222";
const APP = process.env.APP_URL ?? "http://127.0.0.1:4173/game/candy-cascade";

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
async function waitFor(cdp, expression, timeoutMs = 60000) { const start = Date.now(); while (Date.now() - start < timeoutMs) { if (await evaluate(cdp, expression)) return; await new Promise((resolve) => setTimeout(resolve, 120)); } throw new Error(`Timed out waiting for: ${expression}`); }
function metric(metrics, name) { return metrics.metrics?.find((entry) => entry.name === name)?.value ?? 0; }
async function collect(cdp) { await cdp.send("HeapProfiler.collectGarbage"); await new Promise((resolve) => setTimeout(resolve, 120)); return cdp.send("Performance.getMetrics"); }

const target = await fetch(`${BASE}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" }).then((r) => r.json());
const cdp = new CdpClient(target.webSocketDebuggerUrl);
await cdp.ready();
await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Performance.enable"); await cdp.send("HeapProfiler.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const loaded = cdp.once("Page.loadEventFired"); await cdp.send("Page.navigate", { url: APP }); await loaded;
await waitFor(cdp, `typeof window.__candyRenderCount === 'number' && Boolean(document.querySelector('button[aria-label="Auto play"]'))`, 30000);
await waitFor(cdp, `!document.querySelector('button[aria-label="Auto play"]')?.disabled`, 30000);
await evaluate(cdp, `(() => { const turbo = document.querySelector('button[aria-label="Ativar turbo"]'); turbo?.click(); return true; })()`);
await waitFor(cdp, `document.querySelector('button[aria-label="Desativar turbo"]')?.getAttribute('aria-pressed') === 'true'`, 10000);
await evaluate(cdp, `window.__candyRenderCount = 0; window.__candySymbolRenderCount = 0;`);
const before = await collect(cdp);
await evaluate(cdp, `(() => {
  window.__perfStop = false;
  window.__perfData = { start: performance.now(), frames: 0, deltas: [], longTasks: [], maxNodes: 0, busySamples: 0 };
  let last = performance.now();
  const observer = new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__perfData.longTasks.push(entry.duration); });
  try { observer.observe({ entryTypes: ['longtask'] }); } catch {}
  window.__perfObserver = observer;
  const tick = (now) => {
    if (window.__perfStop) return;
    const delta = now - last;
    if (delta > 0 && delta < 1000) window.__perfData.deltas.push(delta);
    window.__perfData.frames += 1;
    if (document.querySelector('button[aria-label="Girar Candy Cascade"]')?.getAttribute('aria-busy') === 'true') window.__perfData.busySamples += 1;
    window.__perfData.maxNodes = Math.max(window.__perfData.maxNodes, document.querySelectorAll('*').length);
    last = now; requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.querySelector('button[aria-label="Auto play"]')?.click();
  return true;
})()`);
await waitFor(cdp, `Boolean(document.querySelector('button[aria-label="Parar auto play"]'))`, 10000);
await waitFor(cdp, `Boolean(document.querySelector('button[aria-label="Auto play"]')) && document.querySelector('button[aria-label="Girar Candy Cascade"]')?.getAttribute('aria-busy') !== 'true'`, 180000);
await new Promise((resolve) => setTimeout(resolve, 300));
const result = await evaluate(cdp, `(() => {
  window.__perfStop = true; window.__perfObserver?.disconnect?.(); const data = window.__perfData; const elapsed = performance.now() - data.start;
  const sorted = data.deltas.filter((v) => v > 0).sort((a,b) => a-b); const worst = sorted.at(-1) ?? 0; const p99 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .99))] : 0;
  return { elapsedMs: elapsed, avgFps: elapsed > 0 ? data.frames / (elapsed / 1000) : 0, minFps: worst ? 1000 / worst : 0, p99Fps: p99 ? 1000 / p99 : 0, worstFrameMs: worst, p99FrameMs: p99, longTasks: data.longTasks.length, maxLongTaskMs: data.longTasks.length ? Math.max(...data.longTasks) : 0, renderCount: window.__candyRenderCount ?? null, symbolRenderCount: window.__candySymbolRenderCount ?? null, busySamples: data.busySamples, maxDomNodes: data.maxNodes };
})()`);
const after = await collect(cdp);
result.jsHeapBefore = metric(before, "JSHeapUsedSize"); result.jsHeapAfter = metric(after, "JSHeapUsedSize"); result.jsHeapDelta = result.jsHeapAfter - result.jsHeapBefore;
result.taskDuration = metric(after, "TaskDuration") - metric(before, "TaskDuration"); result.scriptDuration = metric(after, "ScriptDuration") - metric(before, "ScriptDuration"); result.layoutDuration = metric(after, "LayoutDuration") - metric(before, "LayoutDuration"); result.recalcStyleDuration = metric(after, "RecalcStyleDuration") - metric(before, "RecalcStyleDuration");
if (!result.busySamples || result.renderCount < 5) throw new Error(`Invalid Candy stress run: ${JSON.stringify(result)}`);
console.log(JSON.stringify(result)); cdp.close();
