import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

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
  if (id === "lollipop") {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className="cc-symbol-svg">
        <path d="M52 61 66 91" stroke="#f9e6ff" strokeWidth="8" strokeLinecap="round" />
        <circle cx="43" cy="42" r="29" fill="#ff4fb8" stroke="#8d145f" strokeWidth="6" />
        <path d="M28 42c0-18 26-18 26-3 0 13-21 12-21 0 0-9 14-10 16-2" fill="none" stroke="#fff2ff" strokeWidth="7" strokeLinecap="round" />
        <circle cx="34" cy="29" r="6" fill="#ffffff" opacity=".75" />
      </svg>
    );
  }

  if (id === "star") {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className="cc-symbol-svg">
        <path d="m50 8 12 25 28 4-20 20 5 28-25-13-25 13 5-28L10 37l28-4Z" fill="#ffd74a" stroke="#a85d00" strokeWidth="6" strokeLinejoin="round" />
        <path d="m50 23 7 15 17 3-12 11 3 17-15-8-15 8 3-17-12-11 17-3Z" fill="#fff49a" opacity=".8" />
      </svg>
    );
  }

  if (id === "jelly") {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className="cc-symbol-svg">
        <path d="M18 64c0-28 14-46 32-46s32 18 32 46c0 17-8 24-16 18-7-6-11 8-18 2-8-7-12 6-20-1-6-5-10-9-10-19Z" fill="#7d50ff" stroke="#35177f" strokeWidth="6" />
        <ellipse cx="39" cy="39" rx="10" ry="14" fill="#c7b7ff" opacity=".7" />
        <circle cx="65" cy="50" r="7" fill="#52e3ff" opacity=".85" />
      </svg>
    );
  }

  if (id === "candy") {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className="cc-symbol-svg">
        <path d="m20 37-13 13 13 13 14-7V44Z" fill="#ff7b4b" stroke="#8e273c" strokeWidth="5" strokeLinejoin="round" />
        <path d="m80 37 13 13-13 13-14-7V44Z" fill="#ff7b4b" stroke="#8e273c" strokeWidth="5" strokeLinejoin="round" />
        <rect x="27" y="27" width="46" height="46" rx="18" fill="#ff315f" stroke="#8e1737" strokeWidth="6" />
        <path d="M38 34c9 8 15 21 24 32" stroke="#ffd85c" strokeWidth="10" strokeLinecap="round" />
        <path d="M55 31c7 8 10 17 13 27" stroke="#fff1aa" strokeWidth="5" strokeLinecap="round" opacity=".75" />
      </svg>
    );
  }

  if (id === "cupcake") {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className="cc-symbol-svg">
        <path d="M26 52h49l-7 35H33Z" fill="#ef6eaa" stroke="#7d1e55" strokeWidth="6" strokeLinejoin="round" />
        <path d="M39 54v28M51 54v30M63 54v27" stroke="#ffd1e9" strokeWidth="4" opacity=".75" />
        <path d="M28 54c-8-13 5-20 14-17-2-13 21-19 27-5 15-4 22 14 9 23Z" fill="#fff2ff" stroke="#a64a87" strokeWidth="6" strokeLinejoin="round" />
        <circle cx="58" cy="23" r="9" fill="#ff3f68" stroke="#8b1838" strokeWidth="4" />
        <path d="M60 15c2-7 8-8 12-7" fill="none" stroke="#59a537" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (id === "sprinkle") {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className="cc-symbol-svg">
        <circle cx="50" cy="50" r="35" fill="#e5a157" stroke="#82451d" strokeWidth="6" />
        <circle cx="50" cy="50" r="29" fill="#ff85cf" />
        <circle cx="50" cy="50" r="11" fill="#5a204c" />
        <path d="m28 35 8 4m15-12 2 8m19 4 7-5M31 64l7-4m18 13 1-8m17-7 7 4" stroke="#fff37a" strokeWidth="5" strokeLinecap="round" />
        <path d="m42 31 5 3m15 19 5-4M41 68l5-3" stroke="#50e6ff" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (id === "heart") {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className="cc-symbol-svg">
        <path d="M50 86S14 66 14 38c0-24 31-31 36-9 5-22 36-15 36 9 0 28-36 48-36 48Z" fill="#ff3d91" stroke="#8b174f" strokeWidth="6" strokeLinejoin="round" />
        <path d="M28 39c1-9 9-13 17-9" fill="none" stroke="#ffd9ee" strokeWidth="7" strokeLinecap="round" opacity=".8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="cc-symbol-svg">
      <path d="M18 33 36 13h28l18 20-32 55Z" fill="#39e0ff" stroke="#086c93" strokeWidth="6" strokeLinejoin="round" />
      <path d="M18 33h64M36 13l14 20 14-20M36 33l14 55 14-55" fill="none" stroke="#d7fbff" strokeWidth="5" strokeLinejoin="round" opacity=".9" />
      <path d="M30 27h16" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity=".85" />
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
