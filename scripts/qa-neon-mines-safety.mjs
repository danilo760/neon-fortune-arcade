import puppeteer from "puppeteer-core";

const baseUrl = "http://127.0.0.1:4173/game/neon-mines";
const storageKey = "lucky-neon-arcade:v1";
const seed = { balance: 1_000_000, favorites: [], soundEnabled: true, history: [], totalSpins: 0, bestWin: 0 };
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage"] });

async function pageAt(width = 390, height = 844, reduced = false) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.evaluateOnNewDocument(({ storageKey, seed }) => localStorage.setItem(storageKey, JSON.stringify(seed)), { storageKey, seed });
  await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 60_000 });
  await page.waitForFunction(() => document.body.innerText.includes("GEMAS SEGURAS"));
  return { page, errors };
}
async function clickPrefix(page, prefix) {
  await page.evaluate(prefix => {
    const b = [...document.querySelectorAll("button")].find(x => (x.getAttribute("aria-label") || "").startsWith(prefix));
    if (!(b instanceof HTMLButtonElement)) throw new Error(`missing ${prefix}`);
    b.click();
  }, prefix);
}
async function setRisk(page, count) {
  await page.waitForFunction(count => [...document.querySelectorAll("button")].some(b => (b.getAttribute("aria-label") || "").startsWith(`${count} minas, risco`) && !b.disabled), {}, count);
  await clickPrefix(page, `${count} minas, risco`);
}
async function start(page) {
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => (b.getAttribute("aria-label") || "").startsWith("Abrir cofre apostando") && !b.disabled));
  await clickPrefix(page, "Abrir cofre apostando");
  await page.waitForFunction(() => document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status') === 'playing');
}
async function reveal(page) {
  const info = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(x => (x.getAttribute("aria-label") || "").startsWith("Revelar casa") && !x.disabled);
    const label = b?.getAttribute("aria-label") || "";
    return { label, index: Number(label.match(/\d+/)?.[0] || 0) };
  });
  if (!info.index) throw new Error("no revealable tile");
  await clickPrefix(page, info.label);
  await page.waitForFunction(index => {
    const cabinet = document.querySelector('.mines-premium__cabinet');
    return cabinet?.getAttribute('data-round-status') === 'lost' || (cabinet?.getAttribute('data-reveal-phase') === 'idle' && [...document.querySelectorAll("button")].some(b => b.getAttribute("aria-label") === `Casa ${index}, segura`));
  }, {}, info.index);
  return await page.evaluate(() => document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status') === 'lost' ? "mine" : "safe");
}
async function reset(page) {
  await page.evaluate(({ storageKey, seed }) => localStorage.setItem(storageKey, JSON.stringify(seed)), { storageKey, seed });
  await page.reload({ waitUntil: "networkidle2" });
}

const { page, errors } = await pageAt();

// PT-BR and base layout.
const language = await page.evaluate(() => {
  const text = document.body.innerText;
  const forbidden = ["SAFE GEMS","remaining","NEXT WIN","POSSIBLE WIN","MINES / RISK","SECURING","OPEN VAULT","Vault breached","Crystal secured","CASH OUT"];
  const required = ["GEMAS SEGURAS","PRÓXIMO GANHO","RISCO","MULTIPLICADOR","ENCONTRADAS","GANHO POSSÍVEL","MINAS / RISCO","ABRIR COFRE"];
  return { forbidden: forbidden.filter(x => text.includes(x)), required: required.filter(x => text.includes(x)) };
});
if (language.forbidden.length || language.required.length !== 8) throw new Error(`localization ${JSON.stringify(language)}`);

// Double start = one debit, one spin.
await setRisk(page, 3);
const beforeStart = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || "{}"), storageKey);
const bet = await page.evaluate(() => Number(([...document.querySelectorAll("button")].find(b => (b.getAttribute("aria-label") || "").startsWith("Abrir cofre apostando"))?.getAttribute("aria-label") || "").replace(/\D/g,"")));
await page.evaluate(() => { const b=[...document.querySelectorAll("button")].find(x => (x.getAttribute("aria-label") || "").startsWith("Abrir cofre apostando")); b?.click(); b?.click(); });
await page.waitForFunction(() => document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status') === 'playing');
const afterStart = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || "{}"), storageKey);
if (afterStart.totalSpins !== beforeStart.totalSpins + 1 || afterStart.balance !== beforeStart.balance - bet) throw new Error("double start failed");

// Rapid tap = exactly one semantic result.
const historyBeforeRapid = afterStart.history.length;
await page.evaluate(() => [...document.querySelectorAll("button")].filter(b => (b.getAttribute("aria-label") || "").startsWith("Revelar casa") && !b.disabled).slice(0,10).forEach(b => b.click()));
await page.waitForFunction(() => { const c=document.querySelector('.mines-premium__cabinet'); return c?.getAttribute('data-round-status') === 'lost' || c?.getAttribute('data-reveal-phase') === 'idle'; });
const rapid = await page.evaluate(key => ({ safe: [...document.querySelectorAll("button")].filter(b => /Casa \d+, segura/.test(b.getAttribute("aria-label") || "")).length, status: document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status'), state: JSON.parse(localStorage.getItem(key) || "{}") }), storageKey);
const rapidAccepted = rapid.safe + (rapid.status === "lost" ? rapid.state.history.length - historyBeforeRapid : 0);
if (rapidAccepted !== 1) throw new Error(`rapid tap accepted ${rapidAccepted}`);

// Obtain one safe tile and double cashout = exactly one record and credit.
await reset(page); await setRisk(page, 3);
let safe = false;
for (let i=0; i<10 && !safe; i++) { await start(page); safe = (await reveal(page)) === "safe"; }
if (!safe) throw new Error("no safe tile for cashout test");
const beforeCash = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || "{}"), storageKey);
await page.evaluate(() => { const b=[...document.querySelectorAll("button")].find(x => (x.getAttribute("aria-label") || "").startsWith("Garantir ganho de")); b?.click(); b?.click(); });
await page.waitForFunction(() => document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status') === 'won');
const afterCash = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || "{}"), storageKey);
if (afterCash.history.length !== beforeCash.history.length + 1) throw new Error("double cashout recorded twice");
const entry = afterCash.history.find(x => x.slug === "neon-mines" && x.payout > 0);
if (!entry || afterCash.balance !== beforeCash.balance + entry.payout) throw new Error("double cashout credit mismatch");

// Keyboard Enter on cashout also stays single-credit because the synchronous settledRef closes it.
await reset(page); await setRisk(page, 3); safe = false;
for (let i=0; i<10 && !safe; i++) { await start(page); safe = (await reveal(page)) === "safe"; }
if (!safe) throw new Error("no safe tile for keyboard cashout test");
const beforeEnter = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || "{}"), storageKey);
await page.evaluate(() => { const b=[...document.querySelectorAll("button")].find(x => (x.getAttribute("aria-label") || "").startsWith("Garantir ganho de")); if (b instanceof HTMLButtonElement) b.focus(); });
await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
await page.waitForFunction(() => document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status') === 'won');
const afterEnter = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || "{}"), storageKey);
if (afterEnter.history.length !== beforeEnter.history.length + 1) throw new Error("Enter cashout recorded twice");

// Reduced motion stays functional and releases quickly.
const reduced = await pageAt(390,844,true); await setRisk(reduced.page,3); await start(reduced.page);
const t0 = performance.now(); const reducedOutcome = await reveal(reduced.page); const reducedMs = performance.now()-t0;
if (reducedMs > 250) throw new Error(`reduced motion too slow ${reducedMs}`);
if (reduced.errors.length) throw new Error(`reduced errors ${reduced.errors.join(" | ")}`);
await reduced.page.close();

// Mobile no horizontal overflow; critical controls remain rendered.
const mobile=[];
for (const [width,height] of [[360,800],[390,844],[430,932]]) {
  await page.setViewport({width,height,deviceScaleFactor:1}); await reset(page);
  const info=await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, grid: !!document.querySelector('.mines-premium__grid'), selector: !!document.querySelector('.mines-premium__selector'), start: [...document.querySelectorAll("button")].some(b => (b.getAttribute("aria-label") || "").startsWith("Abrir cofre apostando")), risks: [...document.querySelectorAll("button")].filter(b => /minas, risco/.test(b.getAttribute("aria-label") || "")).length }));
  if (info.overflow || !info.grid || !info.selector || !info.start || info.risks !== 4) throw new Error(`mobile ${width}x${height} ${JSON.stringify(info)}`);
  mobile.push({viewport:`${width}x${height}`,...info});
}

// Exercise 1/5/10 mine modes: restart, at least one safe+cashout and one mine observed.
const risks=[];
for (const risk of [1,5,10]) {
  await page.setViewport({width:390,height:844,deviceScaleFactor:1}); await reset(page); await setRisk(page,risk);
  let sawMine=false, cashed=false, starts=0;
  while ((!sawMine || !cashed) && starts < 20) {
    await start(page); starts++;
    while (true) {
      const outcome=await reveal(page);
      if (outcome === "mine") { sawMine=true; break; }
      if (!cashed) { await clickPrefix(page,"Garantir ganho de"); await page.waitForFunction(() => document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status') === 'won'); cashed=true; break; }
    }
  }
  if (!sawMine || !cashed) throw new Error(`risk ${risk} incomplete`);
  risks.push({risk,sawMine,cashed,starts});
}

if (errors.length) throw new Error(`console errors ${errors.join(" | ")}`);
console.log("MINES_SAFETY_QA", JSON.stringify({ language, doubleStart:{bet,before:beforeStart.balance,after:afterStart.balance}, rapidTap:{accepted:rapidAccepted,status:rapid.status}, doubleCashout:{payout:entry.payout,before:beforeCash.balance,after:afterCash.balance}, enterCashout:{historyDelta:afterEnter.history.length-beforeEnter.history.length}, reducedMotion:{outcome:reducedOutcome,elapsedMs:Number(reducedMs.toFixed(1))}, mobile, risks, errors }));
await page.close(); await browser.close();
