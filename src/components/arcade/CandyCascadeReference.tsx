import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatCoins } from "@/lib/arcade/format";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import "./CandyCascadePremiumV2.css";

type SymbolId = "lollipop" | "star" | "jelly" | "candy" | "cupcake" | "sprinkle" | "heart" | "diamond";
type SymbolDef = { id: SymbolId; weight: number; pay: number };
type Cluster = { symbol: SymbolId; indexes: number[] };

const COLS = 5;
const ROWS = 6;
const BET_STEPS = [10, 50, 100, 200, 500, 1_000, 5_000, 10_000] as const;
const BOMB_MULTIPLIERS = [2, 3, 5, 10] as const;

const SYMBOLS: readonly SymbolDef[] = [
  { id: "diamond", weight: 5, pay: 1.8 },
  { id: "heart", weight: 7, pay: 1.35 },
  { id: "sprinkle", weight: 9, pay: 1.05 },
  { id: "cupcake", weight: 11, pay: 0.85 },
  { id: "lollipop", weight: 13, pay: 0.68 },
  { id: "star", weight: 15, pay: 0.55 },
  { id: "jelly", weight: 17, pay: 0.45 },
  { id: "candy", weight: 19, pay: 0.36 },
];

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
const SYMBOL_BY_ID = new Map(SYMBOLS.map((symbol) => [symbol.id, symbol]));

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function pickSymbol(): SymbolId {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const symbol of SYMBOLS) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol.id;
  }
  return "candy";
}

function makeGrid() {
  return Array.from({ length: COLS * ROWS }, pickSymbol);
}

function neighbors(index: number) {
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  const out: number[] = [];
  if (row > 0) out.push(index - COLS);
  if (row < ROWS - 1) out.push(index + COLS);
  if (col > 0) out.push(index - 1);
  if (col < COLS - 1) out.push(index + 1);
  return out;
}

function findClusters(grid: readonly SymbolId[]): Cluster[] {
  const visited = new Set<number>();
  const clusters: Cluster[] = [];
  for (let start = 0; start < grid.length; start += 1) {
    if (visited.has(start)) continue;
    const symbol = grid[start];
    if (!symbol) continue;
    const queue = [start];
    const indexes: number[] = [];
    visited.add(start);
    while (queue.length) {
      const current = queue.shift();
      if (current === undefined) break;
      indexes.push(current);
      for (const next of neighbors(current)) {
        if (!visited.has(next) && grid[next] === symbol) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    if (indexes.length >= 5) clusters.push({ symbol, indexes });
  }
  return clusters;
}

function clusterPayout(clusters: readonly Cluster[], bet: number) {
  return clusters.reduce((sum, cluster) => {
    const def = SYMBOL_BY_ID.get(cluster.symbol);
    if (!def) return sum;
    const sizeBoost = cluster.indexes.length >= 12 ? 5 : cluster.indexes.length >= 9 ? 3 : cluster.indexes.length >= 7 ? 1.8 : 1;
    return sum + bet * def.pay * sizeBoost;
  }, 0);
}

function collapseGrid(grid: readonly SymbolId[], removed: Set<number>) {
  const next = [...grid];
  for (let col = 0; col < COLS; col += 1) {
    const survivors: SymbolId[] = [];
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      const index = row * COLS + col;
      const symbol = grid[index];
      if (!removed.has(index) && symbol) survivors.push(symbol);
    }
    for (let row = ROWS - 1, cursor = 0; row >= 0; row -= 1, cursor += 1) {
      const index = row * COLS + col;
      next[index] = survivors[cursor] ?? pickSymbol();
    }
  }
  return next;
}

function CandySymbol({ id }: { id: SymbolId }) {
  if (id === "lollipop") {
    return (
      <svg viewBox="0 0 100 100" className="cc2-symbol" aria-hidden="true">
        <defs>
          <radialGradient id="lp-disc" cx="34%" cy="25%"><stop stopColor="#fff7ff"/><stop offset=".18" stopColor="#ffb3df"/><stop offset=".55" stopColor="#ff49ae"/><stop offset="1" stopColor="#b41469"/></radialGradient>
          <linearGradient id="lp-stick" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset=".45" stopColor="#ffe4fb"/><stop offset="1" stopColor="#cba2cf"/></linearGradient>
        </defs>
        <path d="M51 57 69 91" stroke="url(#lp-stick)" strokeWidth="9" strokeLinecap="round"/>
        <circle cx="42" cy="39" r="31" fill="#8b145b"/>
        <circle cx="42" cy="39" r="27" fill="url(#lp-disc)" stroke="#ffd3ef" strokeWidth="2"/>
        <path d="M24 41c1-18 30-22 34-5 4 17-23 23-28 8-4-12 15-18 21-8 5 8-5 16-13 11" fill="none" stroke="#fff8ff" strokeWidth="7" strokeLinecap="round"/>
        <ellipse className="shine" cx="31" cy="25" rx="8" ry="5" fill="#fff" opacity=".75"/>
      </svg>
    );
  }

  if (id === "star") {
    return (
      <svg viewBox="0 0 100 100" className="cc2-symbol" aria-hidden="true">
        <defs><linearGradient id="st-g" x1=".2" y1="0" x2=".8" y2="1"><stop stopColor="#fff7a9"/><stop offset=".28" stopColor="#ffd53e"/><stop offset=".72" stopColor="#ffae19"/><stop offset="1" stopColor="#c86a00"/></linearGradient></defs>
        <path d="m50 7 13 26 29 4-21 20 5 30-26-14-26 14 5-30L8 37l29-4Z" fill="#8c4900" stroke="#6d2a00" strokeWidth="4" strokeLinejoin="round"/>
        <path d="m50 13 11 24 26 4-19 18 5 25-23-12-23 12 5-25-19-18 26-4Z" fill="url(#st-g)" stroke="#ffe879" strokeWidth="2" strokeLinejoin="round"/>
        <path className="shine" d="M42 27c7-6 15-4 19 0" fill="none" stroke="#fff7cf" strokeWidth="5" strokeLinecap="round" opacity=".75"/>
      </svg>
    );
  }

  if (id === "jelly") {
    return (
      <svg viewBox="0 0 100 100" className="cc2-symbol" aria-hidden="true">
        <defs><radialGradient id="jl-g" cx="32%" cy="22%"><stop stopColor="#d9c9ff"/><stop offset=".28" stopColor="#8d76ff"/><stop offset=".72" stopColor="#5e3de7"/><stop offset="1" stopColor="#321a93"/></radialGradient></defs>
        <path d="M16 65c0-30 15-49 34-49s34 19 34 49c0 18-9 27-18 19-7-6-11 7-18 2-8-7-13 6-21-1-7-6-11-10-11-20Z" fill="#2c177d" stroke="#21105e" strokeWidth="5"/>
        <path d="M21 62c0-26 13-42 29-42s29 16 29 42c0 16-7 22-14 16-7-6-11 7-18 2-8-6-11 5-18-1-5-5-8-8-8-17Z" fill="url(#jl-g)"/>
        <ellipse className="shine" cx="39" cy="36" rx="10" ry="15" fill="#fff" opacity=".42"/>
        <circle cx="64" cy="51" r="7" fill="#5fe8ff" opacity=".8"/>
        <path d="M25 68c7 5 11-4 17 1 7 6 12-4 18 0" fill="none" stroke="#b8a5ff" strokeWidth="3" opacity=".8"/>
      </svg>
    );
  }

  if (id === "candy") {
    return (
      <svg viewBox="0 0 100 100" className="cc2-symbol" aria-hidden="true">
        <defs><linearGradient id="ca-g" x1=".1" y1="0" x2=".9" y2="1"><stop stopColor="#ff9b7d"/><stop offset=".25" stopColor="#ff4569"/><stop offset=".7" stopColor="#ff2f5d"/><stop offset="1" stopColor="#b3123f"/></linearGradient></defs>
        <path d="m20 34-16 16 16 16 16-8V42Z" fill="#ff8d4c" stroke="#8d233e" strokeWidth="4" strokeLinejoin="round"/>
        <path d="m80 34 16 16-16 16-16-8V42Z" fill="#ff8d4c" stroke="#8d233e" strokeWidth="4" strokeLinejoin="round"/>
        <rect x="25" y="24" width="50" height="52" rx="20" fill="url(#ca-g)" stroke="#861233" strokeWidth="5"/>
        <path d="M34 30c8 9 16 25 28 38" stroke="#ffd75b" strokeWidth="11" strokeLinecap="round"/>
        <path d="M55 27c7 8 11 17 15 29" stroke="#fff3a8" strokeWidth="5" strokeLinecap="round" opacity=".8"/>
        <ellipse className="shine" cx="43" cy="31" rx="10" ry="5" fill="#fff" opacity=".55"/>
      </svg>
    );
  }

  if (id === "cupcake") {
    return (
      <svg viewBox="0 0 100 100" className="cc2-symbol" aria-hidden="true">
        <defs><linearGradient id="cp-cup" y1="0" y2="1"><stop stopColor="#ff9fce"/><stop offset="1" stopColor="#d6408d"/></linearGradient><radialGradient id="cp-cream" cx="36%" cy="18%"><stop stopColor="#fff"/><stop offset=".42" stopColor="#fff0fb"/><stop offset="1" stopColor="#ef9dce"/></radialGradient></defs>
        <path d="M25 53h51l-8 35H33Z" fill="#7d1e55" stroke="#5f123f" strokeWidth="4"/>
        <path d="M29 55h43l-7 29H36Z" fill="url(#cp-cup)"/>
        <path d="M39 57v23M51 57v25M63 57v22" stroke="#ffd2e8" strokeWidth="4" opacity=".75"/>
        <path d="M26 55c-8-13 5-22 15-18-2-15 22-21 29-6 16-4 24 15 9 25Z" fill="url(#cp-cream)" stroke="#a84a87" strokeWidth="4"/>
        <circle cx="59" cy="21" r="10" fill="#7f1434"/>
        <circle cx="59" cy="19" r="8" fill="#ff426a"/>
        <path d="M60 12c2-8 9-9 13-8" fill="none" stroke="#5ea83a" strokeWidth="4" strokeLinecap="round"/>
        <ellipse className="shine" cx="43" cy="39" rx="9" ry="5" fill="#fff" opacity=".7"/>
      </svg>
    );
  }

  if (id === "sprinkle") {
    return (
      <svg viewBox="0 0 100 100" className="cc2-symbol" aria-hidden="true">
        <defs><radialGradient id="dn-base" cx="35%" cy="25%"><stop stopColor="#ffd78e"/><stop offset=".52" stopColor="#e99b4c"/><stop offset="1" stopColor="#a95a1e"/></radialGradient><radialGradient id="dn-ice" cx="35%" cy="22%"><stop stopColor="#ffc7e9"/><stop offset=".45" stopColor="#ff75c4"/><stop offset="1" stopColor="#db2e92"/></radialGradient></defs>
        <circle cx="50" cy="50" r="38" fill="#7d4117"/>
        <circle cx="50" cy="48" r="34" fill="url(#dn-base)"/>
        <path d="M20 45c4-18 15-30 31-30 18 0 29 13 31 31-8-4-13 5-20 1-8-5-12 4-19 0-7-5-12 3-23-2Z" fill="url(#dn-ice)"/>
        <circle cx="50" cy="50" r="12" fill="#5b204d" stroke="#b96442" strokeWidth="5"/>
        <path d="m29 35 8 4m15-13 2 9m20 4 7-5M31 66l7-4m20 13 1-9m17-7 7 4" stroke="#fff27b" strokeWidth="5" strokeLinecap="round"/>
        <path d="m42 31 5 3m16 21 6-4M41 69l6-3" stroke="#58e9ff" strokeWidth="4" strokeLinecap="round"/>
        <ellipse className="shine" cx="37" cy="27" rx="9" ry="5" fill="#fff" opacity=".5"/>
      </svg>
    );
  }

  if (id === "heart") {
    return (
      <svg viewBox="0 0 100 100" className="cc2-symbol" aria-hidden="true">
        <defs><radialGradient id="hr-g" cx="34%" cy="22%"><stop stopColor="#ffb4db"/><stop offset=".3" stopColor="#ff6bad"/><stop offset=".72" stopColor="#f33083"/><stop offset="1" stopColor="#a50e52"/></radialGradient></defs>
        <path d="M50 90S10 68 10 37c0-27 34-35 40-10 6-25 40-17 40 10 0 31-40 53-40 53Z" fill="#7d103f" stroke="#681036" strokeWidth="4"/>
        <path d="M50 84S16 64 16 39c0-21 28-27 34-7 6-20 34-14 34 7 0 25-34 45-34 45Z" fill="url(#hr-g)"/>
        <path className="shine" d="M29 38c1-10 10-15 18-10" fill="none" stroke="#ffe2f1" strokeWidth="7" strokeLinecap="round" opacity=".8"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 100" className="cc2-symbol" aria-hidden="true">
      <defs><linearGradient id="dm-g" x1=".15" y1="0" x2=".8" y2="1"><stop stopColor="#e9ffff"/><stop offset=".25" stopColor="#62efff"/><stop offset=".65" stopColor="#10bde8"/><stop offset="1" stopColor="#0874ae"/></linearGradient></defs>
      <path d="M16 32 35 10h30l19 22-34 59Z" fill="#065d84" stroke="#043e67" strokeWidth="4" strokeLinejoin="round"/>
      <path d="M20 33 37 14h26l17 19-30 52Z" fill="url(#dm-g)" stroke="#c7fbff" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M20 33h60M37 14l13 19 13-19M37 33l13 52 13-52" fill="none" stroke="#e3fdff" strokeWidth="4" opacity=".82"/>
      <path className="shine" d="M30 27h18" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".82"/>
    </svg>
  );
}

export function CandyCascadeReference() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const [bet, setBet] = useState<number>(200);
  const [grid, setGrid] = useState<SymbolId[]>(() => makeGrid());
  const [win, setWin] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [cascadeIndex, setCascadeIndex] = useState(0);
  const [bombMultiplier, setBombMultiplier] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const busyRef = useRef(false);
  const autoStopRef = useRef(false);

  useEffect(() => hydrateFromStorage(), []);

  const spinRound = useCallback(async () => {
    if (busyRef.current) return false;
    if (!arcadeActions.placeBet(bet)) {
      playSound("lose", soundEnabled);
      return false;
    }

    busyRef.current = true;
    setSpinning(true);
    setWinning(new Set());
    setCascadeIndex(0);
    setBombMultiplier(1);
    setWin(0);
    setMessage(null);
    playSound("spin", soundEnabled);

    let current = makeGrid();
    for (let step = 0; step < 9; step += 1) {
      setGrid(makeGrid());
      await wait(turbo ? 55 : 85);
    }
    setGrid(current);
    await wait(turbo ? 100 : 220);

    let total = 0;
    let cascades = 0;
    let activeMultiplier = 1;

    for (let chain = 0; chain < 7; chain += 1) {
      const clusters = findClusters(current);
      if (clusters.length === 0) break;
      cascades += 1;
      const removed = new Set(clusters.flatMap((cluster) => cluster.indexes));
      setWinning(removed);
      playSound("win", soundEnabled);
      await wait(turbo ? 160 : 420);

      if (Math.random() < 0.38) {
        const bomb = BOMB_MULTIPLIERS[Math.floor(Math.random() * BOMB_MULTIPLIERS.length)] ?? 2;
        activeMultiplier += bomb;
        setBombMultiplier(activeMultiplier);
        setMessage(`SUGAR BOMB +${bomb}×`);
        playSound("bonus", soundEnabled);
        await wait(turbo ? 190 : 460);
        setMessage(null);
      }

      const amount = clusterPayout(clusters, bet) * activeMultiplier;
      total += amount;
      setWin(Math.round(total));
      setWinning(new Set());
      current = collapseGrid(current, removed);
      setGrid(current);
      setCascadeIndex(cascades);
      playSound("tick", soundEnabled);
      await wait(turbo ? 170 : 430);
    }

    const payout = Math.round(total);
    if (payout > 0) arcadeActions.credit(payout);
    arcadeActions.recordRound({
      slug: "candy-cascade",
      gameName: "Candy Cascade",
      bet,
      payout,
      multiplier: payout > 0 ? payout / bet : 0,
      note: `${cascades} cascata(s) · sugar ×${activeMultiplier}`,
    });

    setSpinning(false);
    setWinning(new Set());
    playSound(payout >= bet * 10 ? "bigWin" : payout > 0 ? "win" : "lose", soundEnabled);
    busyRef.current = false;
    return true;
  }, [bet, soundEnabled, turbo]);

  const startAuto = useCallback(async () => {
    if (busyRef.current || autoLeft > 0) return;
    autoStopRef.current = false;
    for (let left = 10; left > 0; left -= 1) {
      if (autoStopRef.current) break;
      setAutoLeft(left);
      const played = await spinRound();
      if (!played) break;
      await wait(turbo ? 120 : 320);
    }
    setAutoLeft(0);
  }, [autoLeft, spinRound, turbo]);

  const changeBet = (direction: -1 | 1) => {
    if (spinning || autoLeft > 0) return;
    const current = Math.max(0, BET_STEPS.findIndex((value) => value === bet));
    const next = Math.max(0, Math.min(BET_STEPS.length - 1, current + direction));
    const value = BET_STEPS[next];
    if (value !== undefined) setBet(value);
  };

  const setMaxBet = () => {
    if (spinning) return;
    const affordable = [...BET_STEPS].reverse().find((value) => value <= balance);
    if (affordable !== undefined) setBet(affordable);
  };

  const insufficient = bet > balance;

  return (
    <main className="cc2-page">
      <div className="cc2-machine">
        <div className="cc2-sky" aria-hidden="true">
          <div className="cc2-rainbow" />
          <div className="cc2-cloud cc2-cloud-a" />
          <div className="cc2-cloud cc2-cloud-b" />
          <div className="cc2-castle cc2-castle-a" />
          <div className="cc2-castle cc2-castle-b" />
          <div className="cc2-lollipop-deco cc2-lollipop-a" />
          <div className="cc2-lollipop-deco cc2-lollipop-b" />
        </div>

        <header className="cc2-header">
          <Link to="/" aria-label="Voltar ao lobby" className="cc2-back">‹</Link>
          <div className="cc2-brand">
            <div className="cc2-brand-kicker">SWEET WIN</div>
            <h1 className="cc2-logo"><span>CANDY</span><strong>CASCADE</strong></h1>
            <p>CLUSTER PARTY</p>
          </div>
          <button type="button" onClick={() => setTurbo((value) => !value)} aria-pressed={turbo} className={cn("cc2-turbo", turbo && "is-active")}>TURBO</button>
        </header>

        <div className="cc2-jackpot" aria-label="Jackpot fictício decorativo">
          <small>SUGAR JACKPOT</small>
          <strong>1.250.000</strong>
        </div>

        <section className="cc2-board-shell" aria-label="Grade Candy Cascade">
          <div className="cc2-board">
            {grid.map((symbol, index) => (
              <div key={index} className={cn("cc2-cell", spinning && "cc2-ref-roll", winning.has(index) && "cc2-ref-win", cascadeIndex > 0 && !spinning && "cc2-ref-land")}>
                <CandySymbol id={symbol ?? "candy"} />
              </div>
            ))}
          </div>
        </section>

        {winning.size > 0 && (
          <div className="cc2-particles" aria-hidden="true">
            {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
          </div>
        )}
        {message && <div className="cc2-bomb">{message}</div>}

        <section className="cc2-win" aria-live="polite">
          <span>GANHO</span>
          <strong>{formatCoins(win)}</strong>
          {(cascadeIndex > 0 || bombMultiplier > 1) && <small>CASCATA {cascadeIndex} · SUGAR ×{bombMultiplier}</small>}
        </section>

        <section className="cc2-deck">
          <div className="cc2-main-controls">
            <div className="cc2-meter">
              <span>SALDO</span>
              <strong>{formatCoins(balance)}</strong>
            </div>

            <button type="button" onClick={() => void spinRound()} disabled={spinning || autoLeft > 0 || insufficient} aria-label="Girar Candy Cascade" className={cn("cc2-spin", spinning && "is-spinning")}>
              <span className="cc2-spin-arrow">↻</span>
              <small>{spinning ? "GIRO" : "SPIN"}</small>
            </button>

            <div className="cc2-bet">
              <button type="button" onClick={() => changeBet(-1)} disabled={spinning || autoLeft > 0} aria-label="Diminuir aposta">−</button>
              <div><span>APOSTA</span><strong>{formatCoins(bet)}</strong></div>
              <button type="button" onClick={() => changeBet(1)} disabled={spinning || autoLeft > 0} aria-label="Aumentar aposta">+</button>
            </div>
          </div>

          <div className="cc2-actions">
            {autoLeft > 0 ? (
              <button type="button" onClick={() => { autoStopRef.current = true; }} className="cc2-action is-running">PARAR <strong>{autoLeft} GIROS</strong></button>
            ) : (
              <button type="button" onClick={() => void startAuto()} disabled={spinning || insufficient} className="cc2-action">AUTO PLAY <strong>10×</strong></button>
            )}
            <button type="button" onClick={setMaxBet} disabled={spinning} className="cc2-action">MAX <strong>BET</strong></button>
          </div>
        </section>

        {insufficient && <div className="cc2-insufficient">Saldo fictício insuficiente — recarregue moedas grátis no lobby.</div>}
        <footer className="cc2-footer">MOEDAS FICTÍCIAS · SEM VALOR REAL</footer>
      </div>
    </main>
  );
}
