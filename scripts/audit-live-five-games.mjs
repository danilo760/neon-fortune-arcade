import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const BASE = 'https://lucky-glow-arcade.lovable.app/game';
const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const OUT = 'audit-artifacts';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function launchPage(browser, slug) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const client = await page.target().createCDPSession();
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
  await page.goto(`${BASE}/${slug}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => {
    window.__liveAudit = { start: performance.now(), frames: [], last: 0, longTasks: [], mutations: 0 };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__liveAudit.longTasks.push(entry.duration);
      }).observe({ entryTypes: ['longtask'] });
    } catch {}
    new MutationObserver((records) => { window.__liveAudit.mutations += records.length; })
      .observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    const tick = (t) => {
      if (window.__liveAudit.last) window.__liveAudit.frames.push(t - window.__liveAudit.last);
      window.__liveAudit.last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return { page, errors };
}

async function byAria(page, label, exact = true) {
  return await page.evaluateHandle(({ label, exact }) => {
    const nodes = [...document.querySelectorAll('button,[role="button"]')];
    return nodes.find((el) => {
      const value = el.getAttribute('aria-label') || '';
      return exact ? value === label : value.includes(label);
    }) || null;
  }, { label, exact });
}

async function clickAria(page, label, exact = true) {
  const handle = await byAria(page, label, exact);
  const el = handle.asElement();
  if (!el) throw new Error(`aria control not found: ${label}`);
  await el.click();
  await handle.dispose();
}

async function clickText(page, text, scope = 'button') {
  const handle = await page.evaluateHandle(({ text, scope }) => {
    const nodes = [...document.querySelectorAll(scope)];
    return nodes.find((el) => (el.textContent || '').trim().includes(text) && !el.disabled) || null;
  }, { text, scope });
  const el = handle.asElement();
  if (!el) throw new Error(`text control not found: ${text}`);
  await el.click();
  await handle.dispose();
}

async function waitControlReady(page, ariaContains, timeout = 60000) {
  await page.waitForFunction((label) => {
    const el = [...document.querySelectorAll('button')].find((node) => (node.getAttribute('aria-label') || '').includes(label));
    return !!el && !el.disabled && el.getAttribute('aria-busy') !== 'true';
  }, { timeout }, ariaContains);
}

async function spin(page, ariaContains, count) {
  let played = 0;
  for (let i = 0; i < count; i += 1) {
    await waitControlReady(page, ariaContains, 90000);
    await clickAria(page, ariaContains, false);
    await sleep(120);
    await waitControlReady(page, ariaContains, 90000);
    played += 1;
  }
  return played;
}

async function snapshot(page, errors, extra = {}) {
  const data = await page.evaluate(() => {
    const a = window.__liveAudit;
    const frames = a?.frames || [];
    const elapsed = Math.max(1, performance.now() - (a?.start || performance.now()));
    const sorted = [...frames].sort((x, y) => x - y);
    const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
    const worst = sorted.length ? sorted[sorted.length - 1] : 0;
    const buttons = [...document.querySelectorAll('button')].map((b) => ({
      text: (b.textContent || '').trim().replace(/\s+/g, ' '),
      aria: b.getAttribute('aria-label'),
      disabled: b.disabled,
      rect: (() => { const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })(),
    }));
    return {
      title: document.title,
      bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 3500),
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      fps: frames.length / (elapsed / 1000),
      worstFrameMs: worst,
      p95FrameMs: p95,
      longTasks: (a?.longTasks || []).length,
      maxLongTaskMs: Math.max(0, ...(a?.longTasks || [])),
      mutations: a?.mutations || 0,
      heap: performance.memory ? performance.memory.usedJSHeapSize : null,
      buttons,
      storage: Object.fromEntries(Object.entries(localStorage)),
    };
  });
  return { ...data, consoleErrors: errors, ...extra };
}

async function auditGolden(browser) {
  const { page, errors } = await launchPage(browser, 'golden-tiger');
  await waitControlReady(page, 'Girar Golden Tiger', 90000);
  await clickAria(page, 'Alternar turbo');
  const baseSpins = await spin(page, 'Girar Golden Tiger', 12);
  let feature = { button: false, modal: false, activated: false, modalText: '' };
  try {
    await clickText(page, 'BÔNUS');
    feature.button = true;
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    feature.modal = true;
    feature.modalText = await page.$eval('[role="dialog"]', (el) => el.innerText.replace(/\s+/g, ' ').trim());
    await clickText(page, 'ATIVAR');
    feature.activated = true;
    await waitControlReady(page, 'Girar Golden Tiger', 120000);
  } catch (error) { feature.error = error.message; }
  await page.screenshot({ path: `${OUT}/golden-tiger.png`, fullPage: true });
  const result = await snapshot(page, errors, { baseSpins, feature });
  await page.close();
  return result;
}

async function auditOlympus(browser) {
  const { page, errors } = await launchPage(browser, 'olympus-storm');
  await waitControlReady(page, 'Girar Olympus Storm', 90000);
  await clickAria(page, 'Alternar turbo');
  const baseSpins = await spin(page, 'Girar Olympus Storm', 12);
  let feature = { button: false, modal: false, activated: false, modalText: '' };
  try {
    await clickAria(page, 'Abrir Storm Ascension');
    feature.button = true;
    await page.waitForSelector('[data-testid="olympus-feature-modal"]', { timeout: 5000 });
    feature.modal = true;
    feature.modalText = await page.$eval('[data-testid="olympus-feature-modal"]', (el) => el.innerText.replace(/\s+/g, ' ').trim());
    await page.click('[data-testid="olympus-feature-activate"]');
    feature.activated = true;
    await waitControlReady(page, 'Girar Olympus Storm', 120000);
  } catch (error) { feature.error = error.message; }
  await page.screenshot({ path: `${OUT}/olympus-storm.png`, fullPage: true });
  const soundToggleVisible = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /som/i.test(b.getAttribute('aria-label') || '')));
  const result = await snapshot(page, errors, { baseSpins, feature, soundToggleVisible });
  await page.close();
  return result;
}

async function auditCandy(browser) {
  const { page, errors } = await launchPage(browser, 'candy-cascade');
  await waitControlReady(page, 'Girar Candy Cascade', 90000);
  await clickAria(page, 'Ativar turbo', false);
  const baseSpins = await spin(page, 'Girar Candy Cascade', 30);
  const controls = await page.evaluate(() => ({
    bonusVisible: [...document.querySelectorAll('button')].some((b) => /BÔNUS|SUGAR PARTY/i.test(b.textContent || b.getAttribute('aria-label') || '')),
    soundToggleVisible: [...document.querySelectorAll('button')].some((b) => /som/i.test(b.getAttribute('aria-label') || '')),
    info: document.body.innerText.includes('Sugar Bomb'),
  }));
  await page.screenshot({ path: `${OUT}/candy-cascade.png`, fullPage: true });
  const result = await snapshot(page, errors, { baseSpins, controls });
  await page.close();
  return result;
}

async function auditMines(browser) {
  const { page, errors } = await launchPage(browser, 'neon-mines');
  let rounds = 0, safeCashouts = 0, losses = 0;
  await clickAria(page, '3 minas');
  for (let i = 0; i < 10; i += 1) {
    await clickAria(page, 'Abrir cofre apostando', false);
    await sleep(120);
    await clickAria(page, 'Revelar casa 1');
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].some((b) => b.getAttribute('aria-busy') === 'true'), { timeout: 10000 }).catch(() => {});
    await sleep(150);
    const state = await page.evaluate(() => ({
      canCash: [...document.querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') || '').startsWith('Cash out por') && !b.disabled),
      lost: document.body.innerText.includes('Vault breached'),
    }));
    if (state.canCash) {
      await clickAria(page, 'Cash out por', false);
      safeCashouts += 1;
      await sleep(700);
    } else if (state.lost) {
      losses += 1;
      await sleep(500);
    }
    rounds += 1;
  }
  await page.screenshot({ path: `${OUT}/neon-mines.png`, fullPage: true });
  const mixedLanguage = await page.evaluate(() => /SAFE GEMS|NEXT WIN|RISK|CURRENT|FOUND|POSSIBLE WIN|OPEN VAULT|Vault breached|Crystal secured/.test(document.body.innerText));
  const result = await snapshot(page, errors, { rounds, safeCashouts, losses, mixedLanguage });
  await page.close();
  return result;
}

async function auditPlinko(browser) {
  const { page, errors } = await launchPage(browser, 'neon-plinko');
  await clickText(page, 'Alto', '[aria-label="Nível de risco"] button');
  await clickText(page, '16', '[aria-label="Quantidade de linhas"] button');
  await clickText(page, '10', '[aria-label="Bolas por rodada"] button');
  await clickAria(page, 'Ativar auto drop');
  await sleep(30000);
  const autoOn = await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /auto drop/i.test(b.getAttribute('aria-label') || ''))?.getAttribute('aria-pressed') === 'true');
  if (autoOn) await clickAria(page, 'Desativar auto drop');
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((el) => (el.getAttribute('aria-label') || '').startsWith('Soltar '));
    return !!b && !b.disabled;
  }, { timeout: 60000 }).catch(() => {});
  const status = await page.evaluate(() => ({
    body: document.body.innerText.replace(/\s+/g, ' '),
    mixedLanguage: /SKYFALL READY|RISK|ROWS|BALLS|BET|BALANCE|RUN BET|RUN WIN|LAST WIN/.test(document.body.innerText),
    soundToggleVisible: [...document.querySelectorAll('button')].some((b) => /som/i.test(b.getAttribute('aria-label') || '')),
  }));
  await page.screenshot({ path: `${OUT}/neon-plinko.png`, fullPage: true });
  const result = await snapshot(page, errors, { autoStressSeconds: 30, mixedLanguage: status.mixedLanguage, soundToggleVisible: status.soundToggleVisible });
  await page.close();
  return result;
}

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

const results = {};
for (const [name, fn] of [
  ['goldenTiger', auditGolden],
  ['olympusStorm', auditOlympus],
  ['candyCascade', auditCandy],
  ['neonMines', auditMines],
  ['neonPlinko', auditPlinko],
]) {
  try {
    results[name] = await fn(browser);
    console.log(`AUDIT_${name.toUpperCase()} ${JSON.stringify(results[name])}`);
  } catch (error) {
    results[name] = { fatal: error.stack || error.message };
    console.log(`AUDIT_${name.toUpperCase()} ${JSON.stringify(results[name])}`);
  }
}

await browser.close();
fs.writeFileSync(`${OUT}/audit-results.json`, JSON.stringify(results, null, 2));
console.log('AUDIT_FINAL', JSON.stringify(results));
