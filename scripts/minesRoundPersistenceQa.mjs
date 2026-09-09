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
async function reload(client) {
  await client.send("Page.reload", { ignoreCache: true });
  await waitFor(client, `document.readyState === 'complete'`, "page reload");
  await sleep(350);
}

const readStateExpression = `(() => ({
  round: JSON.parse(localStorage.getItem(${JSON.stringify(roundKey)}) || 'null'),
  arcade: JSON.parse(localStorage.getItem(${JSON.stringify(arcadeKey)}) || 'null'),
  status: document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status') ?? null,
  phase: document.querySelector('.mines-premium__cabinet')?.getAttribute('data-reveal-phase') ?? null,
}))()`;

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

  // Round 1 intentionally loses. The real Work failure happened after a loss
  // followed by a second active round, so keep that lifecycle in regression QA.
  await evaluate(client, `(() => {
    const open = [...document.querySelectorAll('button')].find((button) => button.getAttribute('aria-label')?.startsWith('Abrir cofre apostando'));
    open?.click();
    return Boolean(open);
  })()`);
  await waitFor(client, `Boolean(localStorage.getItem(${JSON.stringify(roundKey)}))`, "first round persisted after debit");
  const firstOpened = await evaluate(client, readStateExpression);
  if (firstOpened.status !== "playing") throw new Error(`first round did not start: ${firstOpened.status}`);
  if (!firstOpened.round || firstOpened.round.mineField.length !== firstOpened.round.mineCount) throw new Error("invalid first persisted mine field");
  if (!firstOpened.arcade) throw new Error("arcade state missing after first wager");

  const baselineSpins = firstOpened.arcade.totalSpins - 1;
  const firstMineIndex = firstOpened.round.mineField[0];
  if (!Number.isInteger(firstMineIndex)) throw new Error("could not read a mine from first persisted field");

  await evaluate(client, `(() => {
    const button = document.querySelector('[aria-label="Revelar casa ${firstMineIndex + 1}"]');
    button?.click();
    return Boolean(button);
  })()`);
  await waitFor(client, `document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status') === 'lost'`, "first round loss");
  await waitFor(client, `document.querySelector('.mines-premium__cabinet')?.getAttribute('data-reveal-phase') === 'idle'`, "loss animation settle");
  await waitFor(client, `localStorage.getItem(${JSON.stringify(roundKey)}) === null`, "first loss snapshot clear");

  const afterLoss = await evaluate(client, readStateExpression);
  if (!afterLoss.arcade) throw new Error("arcade state missing after first loss");
  if (afterLoss.arcade.totalSpins !== baselineSpins + 1) throw new Error("first loss wager count mismatch");

  // Round 2 must survive lobby navigation AND a full reload after one safe gem.
  await evaluate(client, `(() => {
    const open = [...document.querySelectorAll('button')].find((button) => button.getAttribute('aria-label')?.startsWith('Abrir cofre apostando'));
    open?.click();
    return Boolean(open);
  })()`);
  await waitFor(client, `Boolean(localStorage.getItem(${JSON.stringify(roundKey)}))`, "second round persisted after debit");

  const secondOpened = await evaluate(client, readStateExpression);
  if (secondOpened.status !== "playing") throw new Error(`second round did not start: ${secondOpened.status}`);
  if (!secondOpened.round || secondOpened.round.mineField.length !== secondOpened.round.mineCount) throw new Error("invalid second persisted mine field");
  if (secondOpened.arcade.totalSpins !== baselineSpins + 2) throw new Error("second wager was not counted exactly once");

  const mines = new Set(secondOpened.round.mineField);
  const safeIndex = Array.from({ length: 25 }, (_, index) => index).find((index) => !mines.has(index));
  if (safeIndex == null) throw new Error("could not find deterministic safe tile from second persisted field");

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

  const beforeLeave = await evaluate(client, readStateExpression);
  if (beforeLeave.round.revealed.length !== 1) throw new Error(`expected one safe gem before leave, got ${beforeLeave.round.revealed.length}`);

  await navigate(client, origin + "/");
  const snapshotInLobby = await evaluate(client, `JSON.parse(localStorage.getItem(${JSON.stringify(roundKey)}) || 'null')`);
  if (!snapshotInLobby || !snapshotInLobby.revealed.includes(safeIndex)) throw new Error("active round snapshot was lost in lobby");

  await navigate(client, appUrl);
  await waitFor(client, `document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status') === 'playing'`, "restored playing round after lobby");
  await waitFor(client, `document.querySelector('[aria-label="Casa ${safeIndex + 1}, segura"]') !== null`, "restored safe tile after lobby");

  const restoredAfterLobby = await evaluate(client, readStateExpression);
  if (JSON.stringify(restoredAfterLobby.round) !== JSON.stringify(beforeLeave.round)) throw new Error("round snapshot changed across lobby navigation");
  if (restoredAfterLobby.arcade.balance !== beforeLeave.arcade.balance) throw new Error(`balance changed on lobby restore: ${beforeLeave.arcade.balance} -> ${restoredAfterLobby.arcade.balance}`);
  if (restoredAfterLobby.arcade.totalSpins !== baselineSpins + 2) throw new Error("lobby restore counted an extra wager");

  await reload(client);
  await waitFor(client, `document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status') === 'playing'`, "restored playing round after reload");
  await waitFor(client, `document.querySelector('[aria-label="Casa ${safeIndex + 1}, segura"]') !== null`, "restored safe tile after reload");

  const restored = await evaluate(client, `(() => {
    const round = JSON.parse(localStorage.getItem(${JSON.stringify(roundKey)}) || 'null');
    const arcade = JSON.parse(localStorage.getItem(${JSON.stringify(arcadeKey)}) || 'null');
    const button = [...document.querySelectorAll('button')].find((item) => item.getAttribute('aria-label')?.startsWith('Garantir ganho de'));
    return {
      round,
      arcade,
      status: document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status'),
      cashoutEnabled: Boolean(button && !button.disabled),
      cashoutLabel: button?.getAttribute('aria-label') ?? '',
    };
  })()`);

  if (restored.status !== "playing") throw new Error(`restored status after reload is ${restored.status}`);
  if (JSON.stringify(restored.round) !== JSON.stringify(beforeLeave.round)) throw new Error("round snapshot changed across reload");
  if (restored.arcade.balance !== beforeLeave.arcade.balance) throw new Error(`balance changed on reload restore: ${beforeLeave.arcade.balance} -> ${restored.arcade.balance}`);
  if (restored.arcade.totalSpins !== baselineSpins + 2) throw new Error("reload restore counted an extra wager");
  if (!restored.cashoutEnabled) throw new Error("cashout is not available after restoring a safe reveal");

  const payoutDigits = restored.cashoutLabel.replace(/\D/g, "");
  const expectedPayout = Number(payoutDigits);
  if (!Number.isFinite(expectedPayout) || expectedPayout <= 0) throw new Error(`could not parse cashout payout from: ${restored.cashoutLabel}`);

  await evaluate(client, `(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.getAttribute('aria-label')?.startsWith('Garantir ganho de'));
    button?.click();
    return Boolean(button);
  })()`);
  await waitFor(client, `localStorage.getItem(${JSON.stringify(roundKey)}) === null`, "snapshot clear on cashout");
  await waitFor(client, `(() => {
    const arcade = JSON.parse(localStorage.getItem(${JSON.stringify(arcadeKey)}) || 'null');
    return arcade && arcade.balance === ${restored.arcade.balance + expectedPayout};
  })()`, "single cashout credit");

  const afterCashout = await evaluate(client, readStateExpression);
  if (afterCashout.arcade.totalSpins !== baselineSpins + 2) throw new Error("cashout changed wager count");
  if (afterCashout.arcade.balance !== restored.arcade.balance + expectedPayout) throw new Error("cashout did not credit exactly once");

  await reload(client);
  await waitFor(client, `Boolean(document.querySelector('.mines-premium__cabinet'))`, "Mines mount after settled reload");
  const afterSettledReload = await evaluate(client, readStateExpression);
  if (afterSettledReload.round !== null) throw new Error("settled round resurrected after reload");
  if (afterSettledReload.arcade.balance !== afterCashout.arcade.balance) throw new Error("settled reload changed balance");
  if (afterSettledReload.arcade.totalSpins !== baselineSpins + 2) throw new Error("settled reload changed wager count");

  console.log(`✅ Mines real-navigation persistence QA passed | loss=${firstMineIndex + 1} | safe=${safeIndex + 1} | payout=${expectedPayout} | spins=2`);
} finally {
  client.close();
  await closeTarget(target.id);
}
