const BASE = "http://127.0.0.1:9222";
const APP = process.env.APP_URL ?? "http://127.0.0.1:4173/game/neon-plinko";
const STRESS_MS = Number(process.env.STRESS_MS ?? 60000);

class CdpClient {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async ready() {
    if (this.ws.readyState !== WebSocket.OPEN) {
      await new Promise((resolve, reject) => {
        this.ws.addEventListener("open", resolve, { once: true });
        this.ws.addEventListener("error", reject, { once: true });
      });
    }
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      const queue = this.listeners.get(message.method);
      if (!queue?.length) return;
      queue.shift()(message.params);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method) {
    return new Promise((resolve) => {
      const queue = this.listeners.get(method) ?? [];
      queue.push(resolve);
      this.listeners.set(method, queue);
    });
  }

  close() {
    this.ws.close();
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "Runtime.evaluate failed";
    throw new Error(detail);
  }
  return result.result?.value;
}

function metric(metrics, name) {
  return metrics.metrics?.find((entry) => entry.name === name)?.value ?? 0;
}

async function waitFor(cdp, expression, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(cdp, expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function collectHeap(cdp) {
  await cdp.send("HeapProfiler.collectGarbage");
  await new Promise((resolve) => setTimeout(resolve, 150));
  return cdp.send("Performance.getMetrics");
}

const target = await fetch(`${BASE}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" }).then((r) => r.json());
const cdp = new CdpClient(target.webSocketDebuggerUrl);
await cdp.ready();
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Performance.enable");
await cdp.send("HeapProfiler.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

const loaded = cdp.once("Page.loadEventFired");
await cdp.send("Page.navigate", { url: APP });
await loaded;

// Waiting for the temporary render counter proves client hydration has happened.
await waitFor(cdp, `typeof window.__plinkoRenderCount === 'number' && window.__plinkoRenderCount >= 1`, 30000);
await waitFor(cdp, `Boolean(document.querySelector('.plinko-ref-auto'))`);

await evaluate(cdp, `(() => {
  const button = [...document.querySelectorAll('.plinko-ref-panel--rows button')].find((node) => node.textContent?.trim() === '16');
  if (!button) throw new Error('ROWS 16 button missing');
  button.click();
  return true;
})()`);
await waitFor(cdp, `[...document.querySelectorAll('.plinko-ref-panel--rows button')].some((node) => node.textContent?.trim() === '16' && node.getAttribute('aria-pressed') === 'true')`);

await evaluate(cdp, `(() => {
  const button = [...document.querySelectorAll('.plinko-ref-panel--balls button')].find((node) => node.textContent?.trim() === '10');
  if (!button) throw new Error('BALLS 10 button missing');
  button.click();
  return true;
})()`);
await waitFor(cdp, `[...document.querySelectorAll('.plinko-ref-panel--balls button')].some((node) => node.textContent?.trim() === '10' && node.getAttribute('aria-pressed') === 'true')`);

// Ignore hydration/configuration renders. Count the stress window only.
await evaluate(cdp, `window.__plinkoRenderCount = 0`);
const memoryBefore = await collectHeap(cdp);

await evaluate(cdp, `(() => {
  window.__perfStop = false;
  window.__perfData = { start: performance.now(), frames: 0, deltas: [], longTasks: [], maxNodes: 0, busySamples: 0 };
  let last = performance.now();
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) window.__perfData.longTasks.push(entry.duration);
  });
  try { observer.observe({ entryTypes: ['longtask'] }); } catch {}
  window.__perfObserver = observer;
  const tick = (now) => {
    if (window.__perfStop) return;
    const delta = now - last;
    if (delta > 0 && delta < 1000) window.__perfData.deltas.push(delta);
    window.__perfData.frames += 1;
    if (document.querySelector('.plinko-ref-drop')?.getAttribute('aria-busy') === 'true') window.__perfData.busySamples += 1;
    window.__perfData.maxNodes = Math.max(window.__perfData.maxNodes, document.querySelectorAll('*').length);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const auto = document.querySelector('.plinko-ref-auto');
  if (!auto) throw new Error('AUTO button missing');
  auto.click();
  return true;
})()`);

await waitFor(cdp, `document.querySelector('.plinko-ref-auto')?.getAttribute('aria-pressed') === 'true'`);
await waitFor(cdp, `document.querySelector('.plinko-ref-drop')?.getAttribute('aria-busy') === 'true'`, 10000);

await new Promise((resolve) => setTimeout(resolve, STRESS_MS));

await evaluate(cdp, `(() => {
  const auto = document.querySelector('.plinko-ref-auto');
  if (auto?.getAttribute('aria-pressed') === 'true') auto.click();
  return true;
})()`);
await waitFor(cdp, `document.querySelector('.plinko-ref-auto')?.getAttribute('aria-pressed') !== 'true'`);
await waitFor(cdp, `document.querySelector('.plinko-ref-drop')?.getAttribute('aria-busy') !== 'true'`, 20000);
await new Promise((resolve) => setTimeout(resolve, 350));

const result = await evaluate(cdp, `(() => {
  window.__perfStop = true;
  window.__perfObserver?.disconnect?.();
  const data = window.__perfData;
  const elapsed = performance.now() - data.start;
  const deltas = data.deltas.filter((value) => value > 0);
  const sorted = [...deltas].sort((a, b) => a - b);
  const worstDelta = sorted.length ? sorted[sorted.length - 1] : 0;
  const p99Delta = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .99))] : 0;
  const avgFps = elapsed > 0 ? data.frames / (elapsed / 1000) : 0;
  const minFps = worstDelta > 0 ? 1000 / worstDelta : 0;
  const p99Fps = p99Delta > 0 ? 1000 / p99Delta : 0;
  const scripts = performance.getEntriesByType('resource').filter((entry) => entry.name.includes('.js'));
  return {
    elapsedMs: elapsed,
    frames: data.frames,
    avgFps,
    minFps,
    p99Fps,
    worstFrameMs: worstDelta,
    p99FrameMs: p99Delta,
    longTasks: data.longTasks.length,
    maxLongTaskMs: data.longTasks.length ? Math.max(...data.longTasks) : 0,
    renderCount: window.__plinkoRenderCount ?? null,
    domNodes: document.querySelectorAll('*').length,
    maxDomNodes: data.maxNodes,
    busySamples: data.busySamples,
    loadedJsTransferBytes: scripts.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
    autoOn: document.querySelector('.plinko-ref-auto')?.getAttribute('aria-pressed') === 'true',
    busy: document.querySelector('.plinko-ref-drop')?.getAttribute('aria-busy') === 'true',
  };
})()`);

const memoryAfter = await collectHeap(cdp);
result.jsHeapBefore = metric(memoryBefore, "JSHeapUsedSize");
result.jsHeapAfter = metric(memoryAfter, "JSHeapUsedSize");
result.jsHeapDelta = result.jsHeapAfter - result.jsHeapBefore;

if (!result.busySamples || result.renderCount < 5) {
  throw new Error(`Invalid stress run: busySamples=${result.busySamples}, renderCount=${result.renderCount}`);
}

console.log(JSON.stringify(result));
cdp.close();
