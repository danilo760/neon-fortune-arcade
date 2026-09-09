const appUrl = process.env.CANDY_CASCADE_URL ?? "http://127.0.0.1:3000/game/candy-cascade";
const cdpUrl = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9224";
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
  await waitFor(client, `document.querySelector('.ccp-machine')?.getAttribute('data-phase') === 'idle'`, "idle Candy");
  await sleep(420);

  const idle = await evaluate(client, `(() => {
    const mascot = document.querySelector('.ccp-mascot-core');
    const symbols = [...document.querySelectorAll('.ccp-symbol')];
    return {
      mascot: mascot ? getComputedStyle(mascot).backgroundImage : '',
      glossComposed: symbols.filter((symbol) => {
        const style = getComputedStyle(symbol);
        const sizes = style.backgroundSize.split(',').map((value) => value.trim());
        const layers = style.backgroundImage.split(/,(?![^()]*\\))/).length;
        return layers >= 3 && sizes.length >= 3 && (style.backgroundSize.includes('96% 96%') || style.backgroundSize.includes('97% 97%') || style.backgroundSize.includes('98% 98%'));
      }).length,
      scrollWidth: document.documentElement.scrollWidth,
      machineWidth: document.querySelector('.ccp-machine')?.getBoundingClientRect().width ?? 0,
    };
  })()`);
  assert(idle.mascot.includes('sugar-sprite-v3'), `Sugar Sprite v3 is not painted: ${idle.mascot}`);
  assert(idle.glossComposed === 30, `expected 30 three-layer candy symbols, got ${idle.glossComposed}`);
  assert(idle.scrollWidth <= 391, `premium Candy overflowed mobile viewport: ${idle.scrollWidth}`);
  assert(idle.machineWidth > 360 && idle.machineWidth <= 391, `unexpected Candy machine width ${idle.machineWidth}`);

  await evaluate(client, `(() => {
    [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('BÔNUS'))?.click();
    return true;
  })()`);
  await waitFor(client, `Boolean(document.querySelector('.ccp-feature-panel'))`, "Sugar Party feature modal");

  const modal = await evaluate(client, `(() => {
    const orb = document.querySelector('.ccp-feature-orb');
    const panel = document.querySelector('.ccp-feature-panel');
    const activate = [...document.querySelectorAll('.ccp-feature-panel button')].find((button) => button.textContent?.includes('ATIVAR'));
    return {
      orb: orb ? getComputedStyle(orb).backgroundImage : '',
      text: panel?.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
      activateDisabled: Boolean(activate?.disabled),
    };
  })()`);
  const partyV3 = modal.orb.includes('symbol-party-v3') || modal.orb.includes('Party%20Candy%20premium%20authorial%20symbol');
  assert(partyV3, `premium Party Candy v3 missing from feature modal: ${modal.orb}`);
  assert(modal.text.includes('SUGAR PARTY'), `feature modal lost Sugar Party identity: ${modal.text}`);
  assert(modal.text.includes('FREE SPINS') || modal.text.includes('Free Spins'), `feature modal no longer explains free spins: ${modal.text}`);
  assert(!modal.activateDisabled, "Candy feature purchase unexpectedly disabled at default fictional balance");

  await evaluate(client, `(() => {
    [...document.querySelectorAll('.ccp-feature-panel button')].find((button) => button.textContent?.includes('ATIVAR'))?.click();
    return true;
  })()`);
  await waitFor(client, `document.querySelector('.ccp-machine')?.classList.contains('is-bonus') === true`, "premium Sugar Party scene");
  await waitFor(client, `["bonus-intro","bonus","spin","landing","anticipation"].includes(document.querySelector('.ccp-machine')?.getAttribute('data-phase'))`, "Sugar Party intro transition");

  const bonus = await evaluate(client, `(() => {
    const machine = document.querySelector('.ccp-machine');
    const mascot = document.querySelector('.ccp-mascot-core');
    const sugarHud = document.querySelector('.ccp-sugar-hud');
    return {
      phase: machine?.getAttribute('data-phase') ?? null,
      isBonus: machine?.classList.contains('is-bonus') ?? false,
      sugarLevel: machine?.getAttribute('data-sugar-level') ?? null,
      mascot: mascot ? getComputedStyle(mascot).backgroundImage : '',
      sugarHudVisible: sugarHud ? getComputedStyle(sugarHud).visibility !== 'hidden' && Number(getComputedStyle(sugarHud).opacity || 1) > .02 : false,
      scrollWidth: document.documentElement.scrollWidth,
    };
  })()`);
  assert(bonus.isBonus, "feature purchase did not switch the full Candy scene into bonus mode");
  assert(bonus.mascot.includes('sugar-sprite-v3'), "Sugar Sprite v3 disappeared during Sugar Party intro");
  assert(bonus.sugarHudVisible, "Sugar Level HUD disappeared during Sugar Party intro");
  assert(Number(bonus.sugarLevel) >= 1, `invalid Sugar Level during bonus: ${bonus.sugarLevel}`);
  assert(bonus.scrollWidth <= 391, `Sugar Party scene overflowed mobile viewport: ${bonus.scrollWidth}`);

  console.log(`✅ Candy premium: Sugar Sprite v3 + 30 gloss symbols + Party Candy v3 + Sugar Party scene passed | phase=${bonus.phase}`);
} finally {
  client.close();
  await closeTarget(target.id);
}
