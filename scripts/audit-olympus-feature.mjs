import puppeteer from "puppeteer-core";

const url = process.env.OLYMPUS_URL ?? "http://127.0.0.1:4173/game/olympus-storm";
const chrome = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const START_BALANCE = 1_000_000;
const BET = 200;
const COST = BET * 9;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function freshPage(browser, viewport = { width: 390, height: 844 }, reducedMotion = false) {
  const page = await browser.newPage();
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  if (reducedMotion) {
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  }
  await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
  await page.evaluate((balance) => {
    localStorage.setItem("lucky-neon-arcade:v1", JSON.stringify({
      balance,
      favorites: [],
      soundEnabled: false,
      history: [],
      totalSpins: 0,
      bestWin: 0,
    }));
  }, START_BALANCE);
  await page.reload({ waitUntil: "networkidle0", timeout: 60_000 });
  await page.waitForSelector('[data-testid="olympus-feature-buy"]', { timeout: 30_000 });
  return page;
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-background-timer-throttling"],
});

try {
  const mobileResults = [];
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    const page = await freshPage(browser, viewport);
    const result = await page.evaluate(() => {
      const feature = document.querySelector('[data-testid="olympus-feature-buy"]');
      const spin = document.querySelector('[aria-label="Girar Olympus Storm"]');
      const doc = document.documentElement;
      const featureRect = feature?.getBoundingClientRect();
      const spinRect = spin?.getBoundingClientRect();
      return {
        overflowX: doc.scrollWidth > doc.clientWidth,
        featureVisible: Boolean(featureRect && featureRect.width > 0 && featureRect.bottom <= window.innerHeight),
        spinVisible: Boolean(spinRect && spinRect.width > 0 && spinRect.top < window.innerHeight),
      };
    });
    assert(!result.overflowX, `${viewport.width}x${viewport.height}: horizontal overflow`);
    assert(result.featureVisible, `${viewport.width}x${viewport.height}: BÔNUS button outside viewport`);
    assert(result.spinVisible, `${viewport.width}x${viewport.height}: SPIN not visible`);

    await page.click('[data-testid="olympus-feature-buy"]');
    await page.waitForSelector('[data-testid="olympus-feature-modal"]');
    const modal = await page.evaluate(() => {
      const panel = document.querySelector(".os-feature-panel");
      const rect = panel?.getBoundingClientRect();
      return rect ? { top: rect.top, bottom: rect.bottom, height: rect.height, viewport: innerHeight } : null;
    });
    assert(modal && modal.top >= 0 && modal.bottom <= modal.viewport, `${viewport.width}x${viewport.height}: feature modal overflow`);
    await page.click('[aria-label="Fechar Storm Ascension"]');
    mobileResults.push({ viewport: `${viewport.width}x${viewport.height}`, ...result, modal });
    await page.close();
  }

  const page = await freshPage(browser);
  const client = await page.createCDPSession();
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.click('[aria-label="Alternar turbo"]');
  await page.click('[data-testid="olympus-feature-buy"]');
  await page.waitForSelector('[data-testid="olympus-feature-modal"]');

  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("lucky-neon-arcade:v1")));
  assert(before.balance === START_BALANCE, "unexpected starting balance");
  assert(before.totalSpins === 0, "unexpected starting paid-spin count");

  await page.evaluate(() => {
    const button = document.querySelector('[data-testid="olympus-feature-activate"]');
    button.click();
    button.click();
  });

  await page.waitForFunction(() => document.querySelector('[data-bonus-active="true"]'), { timeout: 15_000 });
  await page.waitForFunction(() => document.querySelector('[data-bonus-active="false"]'), { timeout: 90_000, polling: 100 });
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="olympus-feature-buy"]');
    return button && !button.disabled;
  }, { timeout: 15_000 });

  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("lucky-neon-arcade:v1")));
  assert(after.totalSpins === 0, `feature buy incorrectly incremented paid spins: ${after.totalSpins}`);
  assert(after.history.length === 1, `double click created ${after.history.length} history entries`);
  const entry = after.history[0];
  assert(entry.gameName === "Olympus Storm", `wrong history game: ${entry.gameName}`);
  assert(entry.note.includes("Storm Ascension"), `missing Storm Ascension history note: ${entry.note}`);
  assert(entry.bet === COST, `history cost mismatch: ${entry.bet}`);
  assert(after.balance === START_BALANCE - COST + entry.payout, `single debit/credit invariant failed: ${after.balance}`);

  await page.evaluate(() => {
    localStorage.setItem("lucky-neon-arcade:v1", JSON.stringify({
      balance: 100,
      favorites: [],
      soundEnabled: false,
      history: [],
      totalSpins: 0,
      bestWin: 0,
    }));
  });
  await page.reload({ waitUntil: "networkidle0" });
  await page.click('[data-testid="olympus-feature-buy"]');
  const insufficientDisabled = await page.$eval('[data-testid="olympus-feature-activate"]', (button) => button.disabled);
  assert(insufficientDisabled, "insufficient balance did not disable feature activation");
  await page.close();

  const autoPage = await freshPage(browser);
  await autoPage.click('[aria-label="Alternar turbo"]');
  await autoPage.click('[aria-label="Auto play"]');
  await autoPage.waitForSelector('[aria-label="Parar auto play"]', { timeout: 10_000 });
  const buyDisabledDuringAuto = await autoPage.$eval('[data-testid="olympus-feature-buy"]', (button) => button.disabled);
  assert(buyDisabledDuringAuto, "feature buy remained enabled during autoplay");
  await autoPage.click('[aria-label="Parar auto play"]');
  await autoPage.close();

  const reducedPage = await freshPage(browser, { width: 390, height: 844 }, true);
  const reduced = await reducedPage.evaluate(() => ({
    spinAnimation: getComputedStyle(document.querySelector(".os-ref-spin-button")).animationName,
  }));
  assert(reduced.spinAnimation === "none", `reduced motion still animates spin: ${reduced.spinAnimation}`);
  await reducedPage.close();

  console.log("OLYMPUS_FEATURE_AUDIT", JSON.stringify({
    mobileResults,
    featureBuy: {
      cost: COST,
      totalSpins: after.totalSpins,
      historyEntries: after.history.length,
      payout: entry.payout,
      finalBalance: after.balance,
      singleDebitCredit: true,
      doubleClickBlocked: true,
      insufficientBlocked: true,
      autoBlocked: true,
    },
    reducedMotion: reduced,
  }));
} finally {
  await browser.close();
}
