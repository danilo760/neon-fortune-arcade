import puppeteer from "puppeteer-core";

const url = process.argv[2] || "http://127.0.0.1:4173/game/neon-mines";
const key = "lucky-neon-arcade:v1";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-background-timer-throttling"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const cdp = await page.target().createCDPSession();
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.evaluateOnNewDocument(({ key }) => localStorage.setItem(key, JSON.stringify({ balance: 1_000_000, favorites: [], soundEnabled: true, history: [], totalSpins: 0, bestWin: 0 })), { key });
await page.goto(url, { waitUntil: "networkidle2", timeout: 60_000 });
await page.waitForFunction(() => document.body.innerText.includes("GEMAS SEGURAS"));
await page.evaluate(() => {
  window.__perf = { frames: [], longTasks: 0, mutations: 0, last: performance.now() };
  const p = window.__perf;
  const tick = now => { const dt = now - p.last; p.last = now; if (dt > 0 && dt < 1000) p.frames.push(dt); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try { new PerformanceObserver(list => { p.longTasks += list.getEntries().length; }).observe({ entryTypes: ["longtask"] }); } catch {}
  new MutationObserver(records => { p.mutations += records.length; }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
});
const click = async prefix => page.evaluate(prefix => { const b = [...document.querySelectorAll("button")].find(x => (x.getAttribute("aria-label") || "").startsWith(prefix)); if (!(b instanceof HTMLButtonElement)) throw new Error(`missing ${prefix}`); b.click(); }, prefix);
await click("3 minas, risco");
async function start() { await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => (b.getAttribute("aria-label") || "").startsWith("Abrir cofre apostando") && !b.disabled)); await click("Abrir cofre apostando"); await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => (b.getAttribute("aria-label") || "").startsWith("Revelar casa") && !b.disabled)); }
async function reveal() { const m = await page.evaluate(() => { const b=[...document.querySelectorAll("button")].find(x => (x.getAttribute("aria-label") || "").startsWith("Revelar casa") && !x.disabled); const label=b?.getAttribute("aria-label") || ""; return { label, index:+(label.match(/\d+/)?.[0]||0) }; }); if (!m.index) throw new Error("no tile"); await click(m.label); await page.waitForFunction(i => { const c=document.querySelector('.mines-premium__cabinet'); return c?.getAttribute('data-round-status')==='lost' || (c?.getAttribute('data-reveal-phase')==='idle' && [...document.querySelectorAll('button')].some(b => b.getAttribute('aria-label')===`Casa ${i}, segura`)); }, {}, m.index); return await page.evaluate(() => document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status')==='lost' ? 'mine' : 'safe'); }
async function cash() { await click("Garantir ganho de"); await page.waitForFunction(() => document.querySelector('.mines-premium__cabinet')?.getAttribute('data-round-status')==='won'); }
let rounds=0,cashouts=0,losses=0;
while(cashouts<5&&rounds<14){await start();rounds++;const r=await reveal();if(r==='mine')losses++;else{await cash();cashouts++;}}
while(losses<5&&rounds<20){await start();rounds++;while(true){const r=await reveal();if(r==='mine'){losses++;break;}}}
await new Promise(r=>setTimeout(r,250));
const perf=await page.evaluate(()=>window.__perf);const frames=perf.frames.slice(5),sorted=[...frames].sort((a,b)=>a-b);const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;const worst=Math.max(...frames),p95=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))];
console.log(JSON.stringify({ rounds, fpsAverage:+(1000/mean(frames)).toFixed(2), fpsMinimum:+(1000/worst).toFixed(2), worstFrameMs:+worst.toFixed(2), p95FrameMs:+p95.toFixed(2), longTasks:perf.longTasks, domMutations:perf.mutations }));
await browser.close();
