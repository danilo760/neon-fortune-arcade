import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatCoins } from "@/lib/arcade/format";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import "./CandyCascadeReference.css";

const candyReference = "https://raw.githubusercontent.com/danilo760/neon-fortune-arcade/a8882b17430f8073e4547a77a53effc3b7e8d9e3/src/assets/candy-cascade/reference.webp";

type SymbolId = "lollipop" | "star" | "jelly" | "candy" | "cupcake" | "sprinkle" | "heart" | "diamond";
type SymbolDef = { id: SymbolId; weight: number; pay: number };
type Crop = { x: number; y: number; w: number; h: number };
type Cluster = { symbol: SymbolId; indexes: number[] };

const FULL_W = 941;
const FULL_H = 1672;
const COLS = 5;
const ROWS = 6;
const BET_STEPS = [10, 50, 100, 200, 500, 1_000, 5_000, 10_000] as const;
const BOMB_MULTIPLIERS = [2, 3, 5, 10] as const;

const CROPS: Record<SymbolId, Crop> = {
  lollipop: { x: 48, y: 395, w: 162, h: 143 },
  star: { x: 214, y: 395, w: 162, h: 143 },
  jelly: { x: 382, y: 395, w: 162, h: 143 },
  candy: { x: 548, y: 395, w: 162, h: 143 },
  cupcake: { x: 716, y: 395, w: 162, h: 143 },
  sprinkle: { x: 382, y: 684, w: 162, h: 143 },
  heart: { x: 548, y: 684, w: 162, h: 143 },
  diamond: { x: 214, y: 971, w: 162, h: 143 },
};

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
  const crop = CROPS[id];
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#480529]">
      <img
        src={candyReference}
        alt=""
        draggable={false}
        className="pointer-events-none absolute max-w-none select-none"
        style={{
          width: `${(FULL_W / crop.w) * 100}%`,
          height: `${(FULL_H / crop.h) * 100}%`,
          left: `${-(crop.x / crop.w) * 100}%`,
          top: `${-(crop.y / crop.h) * 100}%`,
        }}
      />
    </div>
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
  const gridRows = useMemo(() => Array.from({ length: ROWS }, (_, row) => row), []);

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black sm:px-3 sm:py-2">
      <div className="relative mx-auto aspect-[941/1672] w-full max-w-[470px] overflow-hidden bg-[#31001d] shadow-[0_0_100px_rgba(255,54,187,.22)] sm:rounded-[22px]">
        <img src={candyReference} alt="Candy Cascade" draggable={false} className="absolute inset-0 size-full select-none object-fill" />

        <Link to="/" aria-label="Voltar ao lobby" className="absolute right-[1.5%] top-[1.2%] z-50 size-[9%] rounded-full bg-transparent" />

        <div className="absolute left-[4.4%] top-[23.6%] z-20 grid h-[51.2%] w-[91.2%] grid-cols-5 grid-rows-6 overflow-hidden rounded-sm">
          {gridRows.flatMap((row) =>
            Array.from({ length: COLS }, (_, col) => {
              const index = row * COLS + col;
              const symbol = grid[index] ?? "candy";
              return (
                <div key={index} className={cn("relative overflow-hidden border border-[#f7bd45]/55 bg-[#480529]", spinning && "cc-ref-roll", winning.has(index) && "cc-ref-win", cascadeIndex > 0 && !spinning && "cc-ref-land")}>
                  <CandySymbol id={symbol} />
                </div>
              );
            }),
          )}
        </div>

        {message && <div className="cc-ref-bomb absolute left-1/2 top-[48%] z-[70] -translate-x-1/2 rounded-3xl border-2 border-pink-100 bg-[#8e075e]/95 px-6 py-4 text-center font-black text-white shadow-[0_0_50px_rgba(255,66,211,.95)]">{message}</div>}

        <div className="absolute left-[24%] top-[75.3%] z-35 flex h-[7.4%] w-[52%] items-center justify-center rounded-[20px] bg-[#4a075f]/96 text-center shadow-[inset_0_0_16px_rgba(255,85,238,.35)]">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[.16em] text-pink-200">WIN</p>
            <p className="font-serif text-[clamp(1.1rem,7vw,2rem)] font-black leading-none text-[#ffe35f] tabular-nums drop-shadow-[0_2px_0_#6b2b00]">{formatCoins(win)}</p>
            {(cascadeIndex > 0 || bombMultiplier > 1) && <p className="mt-0.5 text-[8px] font-black text-pink-200">CASCADE {cascadeIndex} · SUGAR ×{bombMultiplier}</p>}
          </div>
        </div>

        <div className="absolute left-[4.5%] top-[84.1%] z-35 flex h-[4.5%] w-[28.5%] items-center justify-center rounded-lg bg-[#2b071f]/96 px-1 font-black text-white tabular-nums">{formatCoins(balance)}</div>
        <div className="absolute right-[4.4%] top-[84.1%] z-35 flex h-[4.5%] w-[24%] items-center justify-center rounded-lg bg-[#2b071f]/96 px-1 font-black text-white tabular-nums">{formatCoins(bet)}</div>

        <button type="button" onClick={() => changeBet(-1)} disabled={spinning || autoLeft > 0} aria-label="Diminuir aposta" className="absolute right-[28.8%] top-[83.5%] z-50 size-[7.5%] rounded-full disabled:opacity-40" />
        <button type="button" onClick={() => changeBet(1)} disabled={spinning || autoLeft > 0} aria-label="Aumentar aposta" className="absolute right-[1.4%] top-[83.5%] z-50 size-[7.5%] rounded-full disabled:opacity-40" />

        <button type="button" onClick={() => setTurbo((value) => !value)} aria-pressed={turbo} aria-label="Alternar turbo" className={cn("absolute right-[1.4%] top-[75.8%] z-50 size-[8.6%] rounded-full", turbo && "ring-2 ring-pink-100 shadow-[0_0_25px_#ff4ed8]")} />

        {autoLeft > 0 ? (
          <button type="button" onClick={() => { autoStopRef.current = true; }} aria-label="Parar auto play" className="absolute left-[4.7%] top-[91.7%] z-50 h-[6.2%] w-[25.5%] rounded-xl"><span className="absolute right-0 top-0 rounded-full bg-pink-500 px-1.5 text-[9px] font-black text-white">{autoLeft}</span></button>
        ) : (
          <button type="button" onClick={() => void startAuto()} disabled={spinning || insufficient} aria-label="Auto play" className="absolute left-[4.7%] top-[91.7%] z-50 h-[6.2%] w-[25.5%] rounded-xl disabled:opacity-40" />
        )}

        <button type="button" onClick={setMaxBet} disabled={spinning} aria-label="Aposta máxima" className="absolute right-[4.6%] top-[91.7%] z-50 h-[6.2%] w-[25.5%] rounded-xl disabled:opacity-40" />

        <button type="button" onClick={() => void spinRound()} disabled={spinning || autoLeft > 0 || insufficient} aria-label="Girar Candy Cascade" className={cn("cc-ref-spin absolute left-[34.7%] top-[83.2%] z-50 size-[30.6%] rounded-full disabled:cursor-not-allowed disabled:opacity-45", spinning && "scale-95")} />

        {insufficient && <div className="absolute inset-x-[12%] bottom-[.7%] z-[70] rounded-xl border border-pink-200/70 bg-fuchsia-950/95 px-3 py-2 text-center text-[10px] font-bold text-pink-50">Saldo fictício insuficiente — recarregue moedas grátis no lobby.</div>}
        <div className="absolute inset-x-0 bottom-[.15%] z-20 text-center text-[7px] font-black tracking-[.16em] text-pink-100/75">MOEDAS FICTÍCIAS · SEM VALOR REAL</div>
      </div>
    </main>
  );
}
