const appUrl = process.env.OLYMPUS_STORM_URL ?? "http://127.0.0.1:3000/game/olympus-storm";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9223";
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
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.socket?.close(); }
}

async function createTarget() {
  const response = await fetch(`${cdpUrl}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Could not create Chrome target: ${response.status}`);
  return response.json();
}
async function closeTarget(id) { await fetch(`${cdpUrl}/json/close/${id}`).catch(() => undefined); }
async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(`Browser evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
  return result.result?.value;
}
async function waitFor(client, expression, label, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(client, expression)) return;
    await sleep(30);
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
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: 390,
    screenHeight: 844,
  });
  await client.send("Page.navigate", { url: appUrl });
  await waitFor(client, `document.readyState === 'complete'`, "document load");
  await waitFor(client, `document.querySelector('.osp-machine')?.getAttribute('data-phase') === 'idle'`, "idle Olympus");
  await sleep(420);

  const idle = await evaluate(client, `(() => {
    const guardian = document.querySelector('.osp-guardian-crest');
    const symbols = [...document.querySelectorAll('.osp-symbol')];
    return {
      guardian: guardian ? getComputedStyle(guardian).backgroundImage : '',
      painted: symbols.filter((symbol) => getComputedStyle(symbol).backgroundImage.includes('symbol-frame-v3')).length,
      scrollWidth: document.documentElement.scrollWidth,
      machineWidth: document.querySelector('.osp-machine')?.getBoundingClientRect().width ?? 0,
    };
  })()`);
  assert(idle.guardian.includes('storm-warden-v3'), `Storm Warden v3 is not painted: ${idle.guardian}`);
  assert(idle.painted === 30, `expected 30 relic-framed symbols, got ${idle.painted}`);
  assert(idle.scrollWidth <= 391, `premium Olympus overflowed mobile viewport: ${idle.scrollWidth}`);
  assert(idle.machineWidth > 360 && idle.machineWidth <= 391, `unexpected machine width ${idle.machineWidth}`);

  await evaluate(client, `(() => {
    [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'BÔNUS')?.click();
    return true;
  })()`);
  await waitFor(client, `Boolean(document.querySelector('.osp-feature-panel'))`, "Olympus feature modal");

  const modal = await evaluate(client, `(() => {
    const orb = document.querySelector('.osp-feature-orb');
    const panel = document.querySelector('.osp-feature-panel');
    const activate = [...document.querySelectorAll('.osp-feature-panel button')].find((button) => button.textContent?.includes('ATIVAR'));
    return {
      orb: orb ? getComputedStyle(orb).backgroundImage : '',
      text: panel?.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
      activateDisabled: Boolean(activate?.disabled),
    };
  })()`);
  assert(modal.orb.includes('symbol-scatter-v3'), `premium Storm Orb v3 missing from feature modal: ${modal.orb}`);
  assert(modal.text.includes('STORM ASCENSION'), `feature modal lost Storm Ascension identity: ${modal.text}`);
  assert(modal.text.includes('FREE SPINS') || modal.text.includes('Free Spins'), `feature modal no longer explains free spins: ${modal.text}`);
  assert(!modal.activateDisabled, "feature purchase unexpectedly disabled at default fictional balance");

  await evaluate(client, `(() => {
    [...document.querySelectorAll('.osp-feature-panel button')].find((button) => button.textContent?.includes('ATIVAR'))?.click();
    return true;
  })()`);
  await waitFor(client, `document.querySelector('.osp-machine')?.classList.contains('is-bonus') === true`, "premium bonus scene");
  await waitFor(client, `["bonus-intro","bonus","spin","landing"].includes(document.querySelector('.osp-machine')?.getAttribute('data-phase'))`, "bonus intro transition");

  const bonus = await evaluate(client, `(() => {
    const machine = document.querySelector('.osp-machine');
    const guardian = document.querySelector('.osp-guardian-crest');
    const stageHud = document.querySelector('.osp-stage-hud');
    return {
      phase: machine?.getAttribute('data-phase') ?? null,
      isBonus: machine?.classList.contains('is-bonus') ?? false,
      machineBackground: machine ? getComputedStyle(machine).backgroundImage : '',
      guardian: guardian ? getComputedStyle(guardian).backgroundImage : '',
      stageHudVisible: stageHud ? getComputedStyle(stageHud).visibility !== 'hidden' && Number(getComputedStyle(stageHud).opacity || 1) > .02 : false,
      scrollWidth: document.documentElement.scrollWidth,
    };
  })()`);
  assert(bonus.isBonus, "feature purchase did not switch the full scene into bonus mode");
  assert(bonus.guardian.includes('storm-warden-v3'), "Warden v3 disappeared during bonus intro");
  assert(bonus.stageHudVisible, "Storm Level HUD disappeared during bonus intro");
  assert(bonus.scrollWidth <= 391, `bonus scene overflowed mobile viewport: ${bonus.scrollWidth}`);

  console.log(`✅ Olympus premium: Warden v3 + 30 relic symbols + Storm Orb v3 + bonus scene passed | phase=${bonus.phase}`);
} finally {
  client.close();
  await closeTarget(target.id);
}
