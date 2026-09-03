import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { formatCoins } from "@/lib/arcade/format";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import "./CandyCascadeReference.css";

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
  const uid = useId().replace(/:/g, "");

  if (id === "lollipop") {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className="cc-symbol-svg">
        <defs>
          <radialGradient id={`${uid}-pop`} cx="34%" cy="25%" r="72%">
            <stop offset="0" stopColor="#fff6ff" />
            <stop offset=".16" stopColor="#ffb7eb" />
            <stop offset=".5" stopColor="#ff4fb8" />
            <stop offset="1" stopColor="#9d145f" />
          </radialGradient>
          <linearGradient id={`${uid}-stick`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset=".5" stopColor="#f7d9ff" />
            <stop offset="1" stopColor="#b58ac6" />
          </linearGradient>
        </defs>
        <path d="M53 60 68 92" stroke={`url(#${uid}-stick)`} strokeWidth="9" strokeLinecap="round" />
        <circle cx="43" cy="41" r="31" fill="#74134f" opacity=".45" />
        <circle cx="43" cy="39" r="29" fill={`url(#${uid}-pop)`} stroke="#7d1659" strokeWidth="5" />
        <path d="M22 39c1-15 12-25 25-25 14 0 24 10 24 23 0 13-10 22-22 22-11 0-19-7-19-16 0-8 6-14 14-14 7 0 12 5 12 11 0 6-4 10-9 10" fill="none" stroke="#fff7ff" strokeWidth="7" strokeLinecap="round" opacity=".95" />
        <path d="M25 26c6-8 15-11 23-10" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity=".72" />
        <ellipse cx="33" cy="25" rx="7" ry="4" fill="#fff" opacity=".85" transform="rotate(-25 33 25)" />
      </svg>
    );
  }

  if (id === "star") {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className="cc-symbol-svg">
        <defs>
          <linearGradient id={`${uid}-star`} x1=".2" y1="0" x2=".8" y2="1">
            <stop offset="0" stopColor="#fff7ae" />
            <stop offset=".45" stopColor="#ffd540" />
            <stop offset="1" stopColor="#ef8b11" />
          </linearGradient>
          <linearGradient id={`${uid}-starInner`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fffbd5" />
            <stop offset="1" stopColor="#ffc52c" />
          </linearGradient>
        </defs>
        <path d="m50 7 12 25 28 4-20 20 5 29-25-14-25 14 5-29L10 36l28-4Z" fill="#7b3d06" opacity=".45" transform="translate(0 3)" />
        <path d="m50 7 12 25 28 4-20 20 5 29-25-14-25 14 5-29L10 36l28-4Z" fill={`url(#${uid}-star)`} stroke="#9b5607" strokeWidth="5" strokeLinejoin="round" />
        <path d="m50 22 7 15 17 2-12 12 3 17-15-8-15 8 3-17-12-12 17-2Z" fill={`url(#${uid}-starInner)`} opacity=".88" />
        <path d="M38 24c4-5 8-7 13-8" stroke="#fffde4" strokeWidth="4" strokeLinecap="round" opacity=".8" />
      </svg>
    );
  }

  if (id === "jelly") {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className="cc-symbol-svg">
        <defs>
          <radialGradient id={`${uid}-jelly`} cx="36%" cy="25%" r="78%">
            <stop offset="0" stopColor="#cfc5ff" />
            <stop offset=".3" stopColor="#8e75ff" />
            <stop offset=".75" stopColor="#6041e8" />
            <stop offset="1" stopColor="#35147f" />
          </radialGradient>
        </defs>
        <ellipse cx="50" cy="78" rx="29" ry="9" fill="#24105c" opacity=".45" />
        <path d="M17 63c0-29 14-47 33-47s33 18 33 47c0 17-8 24-16 18-8-6-11 9-19 2-8-7-12 7-20 0-7-5-11-10-11-20Z" fill={`url(#${uid}-jelly)`} stroke="#35147f" strokeWidth="5" />
        <ellipse cx="38" cy="37" rx="10" ry="15" fill="#ffffff" opacity=".36" transform="rotate(18 38 37)" />
        <ellipse cx="36" cy="31" rx="5" ry="7" fill="#fff" opacity=".72" />
        <circle cx="65" cy="50" r="7" fill="#5fe6ff" opacity=".82" />
        <path d="M28 68c7 6 13 6 20 0 7 6 13 6 21-1" fill="none" stroke="#a993ff" strokeWidth="3" opacity=".65" />
      </svg>
    );
  }

  if (id === "candy") {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className="cc-symbol-svg">
        <defs>
          <linearGradient id={`${uid}-wrap`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffc35f" />
            <stop offset=".5" stopColor="#ff7646" />
            <stop offset="1" stopColor="#c62d4f" />
          </linearGradient>
          <radialGradient id={`${uid}-candy`} cx="35%" cy="24%" r="78%">
            <stop offset="0" stopColor="#ffb66e" />
            <stop offset=".27" stopColor="#ff5a6d" />
            <stop offset=".72" stopColor="#ff2c59" />
            <stop offset="1" stopColor="#9b143d" />
          </radialGradient>
        </defs>
        <path d="m20 37-14 13 14 13 15-7V44Z" fill={`url(#${uid}-wrap)`} stroke="#8e273c" strokeWidth="4" strokeLinejoin="round" />
        <path d="m80 37 14 13-14 13-15-7V44Z" fill={`url(#${uid}-wrap)`} stroke="#8e273c" strokeWidth="4" strokeLinejoin="round" />
        <rect x="27" y="27" width="46" height="46" rx="18" fill="#8d143b" opacity=".45" transform="translate(0 3)" />
        <rect x="27" y="25" width="46" height="46" rx="18" fill={`url(#${uid}-candy)`} stroke="#8e1737" strokeWidth="5" />
        <path d="M36 32c8 8 17 24 28 34" stroke="#ffd75a" strokeWidth="10" strokeLinecap="round" />
        <path d="M52 29c7 8 11 18 14 28" stroke="#fff0aa" strokeWidth="5" strokeLinecap="round" opacity=".88" />
        <ellipse cx="39" cy="32" rx="8" ry="4" fill="#fff" opacity=".55" transform="rotate(-25 39 32)" />
      </svg>
    );
  }

  if (id === "cupcake") {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className="cc-symbol-svg">
        <defs>
          <linearGradient id={`${uid}-cup`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff9bc9" />
            <stop offset="1" stopColor="#d34d8c" />
          </linearGradient>
          <radialGradient id={`${uid}-cream`} cx="38%" cy="20%" r="78%">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset=".5" stopColor="#ffeaf9" />
            <stop offset="1" stopColor="#efb2d8" />
          </radialGradient>
          <radialGradient id={`${uid}-cherry`} cx="35%" cy="25%" r="75%">
            <stop offset="0" stopColor="#ff9aa9" />
            <stop offset=".5" stopColor="#ff385c" />
            <stop offset="1" stopColor="#9b1737" />
          </radialGradient>
        </defs>
        <ellipse cx="51" cy="85" rx="24" ry="7" fill="#591138" opacity=".38" />
        <path d="M25 53h51l-7 34H32Z" fill={`url(#${uid}-cup)`} stroke="#7d1e55" strokeWidth="5" strokeLinejoin="round" />
        <path d="M38 56v26M50 56v28M63 56v25" stroke="#ffd6eb" strokeWidth="4" opacity=".8" />
        <path d="M28 55c-8-12 3-21 14-18-2-12 8-20 18-18 8 1 13 6 14 13 14-3 21 13 9 23Z" fill={`url(#${uid}-cream)`} stroke="#a64a87" strokeWidth="5" strokeLinejoin="round" />
        <path d="M37 43c8-3 23-3 34 1" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity=".7" />
        <circle cx="59" cy="22" r="9" fill={`url(#${uid}-cherry)`} stroke="#8b1838" strokeWidth="3" />
        <path d="M61 15c2-8 9-9 13-8" fill="none" stroke="#64b442" strokeWidth="4" strokeLinecap="round" />
        <circle cx="56" cy="19" r="3" fill="#fff" opacity=".75" />
      </svg>
    );
  }

  if (id === "sprinkle") {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className="cc-symbol-svg">
        <defs>
          <radialGradient id={`${uid}-dough`} cx="36%" cy="24%" r="76%">
            <stop offset="0" stopColor="#ffe5a0" />
            <stop offset=".5" stopColor="#e7a252" />
            <stop offset="1" stopColor="#9a5524" />
          </radialGradient>
          <radialGradient id={`${uid}-icing`} cx="35%" cy="25%" r="78%">
            <stop offset="0" stopColor="#ffd5ef" />
            <stop offset=".36" stopColor="#ff83cd" />
            <stop offset="1" stopColor="#d53c95" />
          </radialGradient>
        </defs>
        <ellipse cx="50" cy="78" rx="29" ry="8" fill="#6e2645" opacity=".38" />
        <circle cx="50" cy="49" r="36" fill={`url(#${uid}-dough)`} stroke="#82451d" strokeWidth="5" />
        <circle cx="50" cy="47" r="29" fill={`url(#${uid}-icing)`} />
        <circle cx="50" cy="49" r="11" fill="#6a294f" stroke="#a76038" strokeWidth="3" />
        <ellipse cx="37" cy="28" rx="9" ry="5" fill="#fff" opacity=".45" transform="rotate(-20 37 28)" />
        <path d="m27 35 8 4m15-12 2 8m19 4 7-5M30 64l8-4m18 14 1-8m17-8 7 4" stroke="#fff073" strokeWidth="5" strokeLinecap="round" />
        <path d="m42 31 6 3m15 19 5-4M41 68l5-3M66 64l5 3" stroke="#43e8ff" strokeWidth="4" strokeLinecap="round" />
        <path d="m32 52 4-6m31-17 5 3" stroke="#77ff9e" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (id === "heart") {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className="cc-symbol-svg">
        <defs>
          <radialGradient id={`${uid}-heart`} cx="35%" cy="23%" r="80%">
            <stop offset="0" stopColor="#ffc2df" />
            <stop offset=".25" stopColor="#ff6daf" />
            <stop offset=".72" stopColor="#ff378b" />
            <stop offset="1" stopColor="#9b174f" />
          </radialGradient>
        </defs>
        <path d="M50 90S14 69 14 39c0-25 31-32 36-9 5-23 36-16 36 9 0 30-36 51-36 51Z" fill="#66123d" opacity=".4" transform="translate(0 2)" />
        <path d="M50 86S14 66 14 38c0-24 31-31 36-9 5-22 36-15 36 9 0 28-36 48-36 48Z" fill={`url(#${uid}-heart)`} stroke="#8b174f" strokeWidth="5" strokeLinejoin="round" />
        <path d="M27 38c1-9 9-14 18-10" fill="none" stroke="#ffe6f3" strokeWidth="6" strokeLinecap="round" opacity=".85" />
        <ellipse cx="34" cy="31" rx="7" ry="4" fill="#fff" opacity=".5" transform="rotate(-26 34 31)" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="cc-symbol-svg">
      <defs>
        <linearGradient id={`${uid}-diamond`} x1=".2" y1="0" x2=".8" y2="1">
          <stop offset="0" stopColor="#efffff" />
          <stop offset=".25" stopColor="#75efff" />
          <stop offset=".62" stopColor="#24c9f5" />
          <stop offset="1" stopColor="#1887d4" />
        </linearGradient>
        <linearGradient id={`${uid}-facet`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#64ddff" />
        </linearGradient>
      </defs>
      <path d="M18 36 36 14h28l18 22-32 55Z" fill="#075b8f" opacity=".4" transform="translate(0 2)" />
      <path d="M18 33 36 13h28l18 20-32 55Z" fill={`url(#${uid}-diamond)`} stroke="#086c93" strokeWidth="5" strokeLinejoin="round" />
      <path d="M18 33h64M36 13l14 20 14-20M36 33l14 55 14-55" fill="none" stroke={`url(#${uid}-facet)`} strokeWidth="4" strokeLinejoin="round" opacity=".95" />
      <path d="M29 26h18" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity=".9" />
      <path d="m25 37 25 51 25-51" fill="none" stroke="#b9f8ff" strokeWidth="2.5" opacity=".62" />
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
    <main className="cc-page">
      <div className="cc-machine">
        <div className="cc-sky" aria-hidden="true">
          <div className="cc-cloud cc-cloud-a" />
          <div className="cc-cloud cc-cloud-b" />
          <div className="cc-candy-hill cc-hill-a" />
          <div className="cc-candy-hill cc-hill-b" />
          <div className="cc-rainbow" />
        </div>

        <header className="cc-header">
          <Link to="/" aria-label="Voltar ao lobby" className="cc-back">‹</Link>
          <div className="cc-title-wrap">
            <span className="cc-title-small">SWEET WIN</span>
            <h1 className="cc-title"><span>CANDY</span><strong>CASCADE</strong></h1>
            <p>CLUSTER PARTY</p>
          </div>
          <button type="button" onClick={() => setTurbo((value) => !value)} aria-pressed={turbo} className={cn("cc-turbo", turbo && "is-active")}>
            TURBO
          </button>
        </header>

        <section className="cc-board-wrap" aria-label="Grade Candy Cascade">
          <div className="cc-board-glow" />
          <div className="cc-board">
            {grid.map((symbol, index) => (
              <div key={index} className={cn("cc-cell", spinning && "cc-ref-roll", winning.has(index) && "cc-ref-win", cascadeIndex > 0 && !spinning && "cc-ref-land")}>
                <CandySymbol id={symbol ?? "candy"} />
              </div>
            ))}
          </div>
        </section>

        {message && <div className="cc-ref-bomb cc-bomb-message">{message}</div>}

        <section className="cc-win-panel" aria-live="polite">
          <span>WIN</span>
          <strong>{formatCoins(win)}</strong>
          {(cascadeIndex > 0 || bombMultiplier > 1) && <small>CASCADE {cascadeIndex} · SUGAR ×{bombMultiplier}</small>}
        </section>

        <section className="cc-controls">
          <div className="cc-meter">
            <span>SALDO</span>
            <strong>{formatCoins(balance)}</strong>
          </div>

          <div className="cc-bet-control">
            <button type="button" onClick={() => changeBet(-1)} disabled={spinning || autoLeft > 0} aria-label="Diminuir aposta">−</button>
            <div>
              <span>APOSTA</span>
              <strong>{formatCoins(bet)}</strong>
            </div>
            <button type="button" onClick={() => changeBet(1)} disabled={spinning || autoLeft > 0} aria-label="Aumentar aposta">+</button>
          </div>

          <button type="button" onClick={() => void spinRound()} disabled={spinning || autoLeft > 0 || insufficient} aria-label="Girar Candy Cascade" className={cn("cc-ref-spin cc-spin", spinning && "is-spinning")}>
            <span className="cc-spin-arrow">↻</span>
            <small>{spinning ? "GIRO" : "SPIN"}</small>
          </button>

          {autoLeft > 0 ? (
            <button type="button" onClick={() => { autoStopRef.current = true; }} className="cc-action cc-auto is-running">
              PARAR <strong>{autoLeft}</strong>
            </button>
          ) : (
            <button type="button" onClick={() => void startAuto()} disabled={spinning || insufficient} className="cc-action cc-auto">
              AUTO <strong>10×</strong>
            </button>
          )}

          <button type="button" onClick={setMaxBet} disabled={spinning} className="cc-action cc-max">
            MAX <strong>BET</strong>
          </button>
        </section>

        {insufficient && <div className="cc-insufficient">Saldo fictício insuficiente — recarregue moedas grátis no lobby.</div>}
        <footer className="cc-footer">MOEDAS FICTÍCIAS · SEM VALOR REAL</footer>
      </div>
    </main>
  );
}