import { mkdir, writeFile } from "node:fs/promises";

const game = process.argv[2];
const configs = {
  olympus: {
    url: process.env.SLOT_AUTO_URL ?? "http://127.0.0.1:3000/game/olympus-storm",
    cdp: process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9223",
    outputDir: "artifacts/olymus-storm-auto",
    machine: ".osp-machine",
    autoButton: ".osp-controls button:last-child",
    options: ".osp-auto-options button",
    spin: ".osp-spin",
    balance: ".osp-economy > div:first-child strong",
  },
  candy: {
    url: process.env.SLOT_AUTO_URL ?? "http://127.0.0.1:3000/game/candy-cascade",
    cdp: process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9224",
    outputDir: "artifacts/candy-cascade-auto",
    machine: ".ccp-machine",
    autoButton: ".ccp-controls button:last-child",
    options: ".ccp-auto-options button",
    spin: ".ccp-spin",
    balance: ".ccp-economy > div:first-child strong",
  },
};

if (!(game in configs)) {
  throw new Error(`Usage: node scripts/slotAutoPlayRegressionQa.mjs <${Object.keys(configs).join("|")}>`);
}

const config = configs[game];
const roundsToCheck = [10, 25, 50];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CdpClient {
  constructor(url) {
    this.url = url;
    this.id = 0;
    this.pending = new Map();
    this.socket = null;
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP websocket timeout")), 8_000);
      this.socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("CDP websocket error"));
      }, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket?.close();
  }
}

async function createTarget() {
  const response = await fetch(`${config.cdp}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Could not create Chrome target: ${response.status}`);
  return response.json();
}

async function closeTarget(id) {
  await fetch(`${config.cdp}/json/close/${id}`).catch(() => undefined);
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(`Browser evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
  return result.result?.value;
}

async function screenshot(client, path) {
  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(path, Buffer.from(result.data, "base64"));
}

await mkdir(config.outputDir, { recursive: true });
const report = [];
let failed = false;

for (const rounds of roundsToCheck) {
  const target = await createTarget();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  const errors = [];
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
    await client.send("Emulation.setEmulatedMedia", {
      media: "screen",
      features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
    });
    await client.send("Page.navigate", { url: config.url });
    await sleep(950);

    const before = await evaluate(client, `(() => {
      const machine = document.querySelector(${JSON.stringify(config.machine)});
      const auto = document.querySelector(${JSON.stringify(config.autoButton)});
      const balance = document.querySelector(${JSON.stringify(config.balance)});
      return {
        ready: Boolean(machine && auto && balance),
        phase: machine?.getAttribute('data-phase') ?? null,
        balance: balance?.textContent?.trim() ?? null,
        autoDisabled: Boolean(auto?.disabled),
      };
    })()`);
    if (!before?.ready) errors.push("game controls did not mount");
    if (before?.autoDisabled) errors.push("Auto button is disabled before launch");

    await evaluate(client, `(() => {
      const auto = document.querySelector(${JSON.stringify(config.autoButton)});
      auto?.click();
      return true;
    })()`);
    await sleep(60);

    const modal = await evaluate(client, `(() => {
      const buttons = [...document.querySelectorAll(${JSON.stringify(config.options)})];
      return { count: buttons.length, labels: buttons.map((button) => button.textContent?.trim()) };
    })()`);
    if (modal?.count !== 3) errors.push(`expected 3 Auto options, got ${modal?.count ?? 0}`);
    if (!modal?.labels?.includes(String(rounds))) errors.push(`Auto option ${rounds} is missing`);

    const clicked = await evaluate(client, `(() => {
      const button = [...document.querySelectorAll(${JSON.stringify(config.options)})]
        .find((candidate) => candidate.textContent?.trim() === ${JSON.stringify(String(rounds))});
      button?.click();
      return Boolean(button);
    })()`);
    if (!clicked) errors.push(`could not click Auto ${rounds}`);

    await sleep(140);
    const active = await evaluate(client, `(() => {
      const machine = document.querySelector(${JSON.stringify(config.machine)});
      const auto = document.querySelector(${JSON.stringify(config.autoButton)});
      const spin = document.querySelector(${JSON.stringify(config.spin)});
      const balance = document.querySelector(${JSON.stringify(config.balance)});
      const options = document.querySelectorAll(${JSON.stringify(config.options)});
      return {
        phase: machine?.getAttribute('data-phase') ?? null,
        balance: balance?.textContent?.trim() ?? null,
        spinText: spin?.textContent?.trim() ?? null,
        modalStillOpen: options.length > 0,
        autoActiveClass: Boolean(auto?.classList.contains('is-active')),
      };
    })()`);

    if (active?.modalStillOpen) errors.push("Auto modal stayed open after selecting rounds");
    if (active?.balance === before?.balance) errors.push("balance did not change after Auto launch");
    if (active?.phase === "idle" || active?.phase === null) errors.push(`Auto ${rounds} did not enter an active phase`);
    if (!active?.autoActiveClass && !active?.spinText?.includes(String(rounds))) {
      errors.push(`Auto ${rounds} did not expose an active counter/state`);
    }

    await screenshot(client, `${config.outputDir}/${game}-auto-${rounds}-active.png`);

    await evaluate(client, `(() => {
      document.querySelector(${JSON.stringify(config.autoButton)})?.click();
      return true;
    })()`);
    await sleep(60);
    const stopped = await evaluate(client, `(() => ({
      autoText: document.querySelector(${JSON.stringify(config.autoButton)})?.textContent?.trim() ?? null,
      phase: document.querySelector(${JSON.stringify(config.machine)})?.getAttribute('data-phase') ?? null,
    }))()`);

    report.push({ rounds, before, modal, active, stopped, errors });
  } finally {
    client.close();
    await closeTarget(target.id);
  }

  if (errors.length) {
    failed = true;
    console.error(`❌ ${game} Auto ${rounds}: ${errors.join("; ")}`);
  } else {
    console.log(`✅ ${game} Auto ${rounds}: launch + debit + stop request passed`);
  }
}

await writeFile(`${config.outputDir}/report.json`, JSON.stringify(report, null, 2));
if (failed) process.exitCode = 1;
