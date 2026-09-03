import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import candyReference from "@/assets/candy-cascade/reference-hq.webp";
import { formatCoins } from "@/lib/arcade/format";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import "./CandyCascadeReference.css";

type SymbolId =
  | "lollipop"
  | "star"
  | "jelly"
  | "candy"
  | "cupcake"
  | "sprinkle"
  | "heart"
  | "diamond";

type SymbolDef = { id: SymbolId; weight: number; pay: number };
type Crop = { x: number; y: number; w: number; h: number };
type Cluster = { symbol: SymbolId; indexes: number[] };

const FULL_W = 600;
const FULL_H = 1066;
const COLS = 6;
const ROWS = 6;
const BET_STEPS = [10, 50, 100, 200, 500, 1_000, 5_000, 10_000] as const;
const BOMB_MULTIPLIERS = [2, 3, 5, 10] as const;

const CROPS: Record<SymbolId, Crop> = {
  lollipop: { x: 24, y: 281, w: 93, h: 87 },
  star: { x: 118, y: 281, w: 93, h: 87 },
  jelly: { x: 212, y: 281, w: 92, h: 87 },
  candy: { x: 305, y: 281, w: 93, h: 87 },
  cupcake: { x: 399, y: 281, w: 92, h: 87 },
  heart: { x: 399, y: 369, w: 92, h: 87 },
  sprinkle: { x: 212, y: 457, w: 92, h: 87 },
  diamond: { x: 305, y: 457, w: 93, h: 87 },
};

const SYMBOLS: readonly SymbolDef[] = [
  { id: "diamond", weight: 5, pay: 2.2 },
  { id: "heart", weight: 7, pay: 1.6 },
  { id: "sprinkle", weight: 9, pay: 1.25 },
  { id: "cupcake", weight: 11, pay: 1.0 },
  { id: "lollipop", weight: 13, pay: 0.82 },
  { id: "star", weight: 15, pay: 0.66 },
  { id: "jelly", weight: 17, pay: 0.52 },
  { id: "candy", weight: 19, pay: 0.42 },
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

function makeGrid(): SymbolId[] {
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
    const count = cluster.indexes.length;
    const boost = count >= 15 ? 7 : count >= 12 ? 5 : count >= 9 ? 3 : count >= 7 ? 1.8 : 1;
    return sum + bet * def.pay * boost;
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
      next[row * COLS + col] = survivors[cursor] ?? pickSymbol();
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

export function CandyCascadeHQ() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const [bet, setBet] = useState<number>(200);
  const [grid, setGrid] = useState<SymbolId[]>(makeGrid);
  const [win, setWin] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [cascadeIndex, setCascadeIndex] = useState(0);
  const [bombMultiplier, setBombMultiplier] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

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
    for (let step = 0; step < (turbo ? 6 : 12); step += 1) {
      setGrid(makeGrid());
      await wait(turbo ? 42 : 72);
    }
    setGrid(current);
    await wait(turbo ? 80 : 190);

    let total = 0;
    let cascades = 0;
    let activeMultiplier = 1;

    for (let chain = 0; chain < 8; chain += 1) {
      const clusters = findClusters(current);
      if (clusters.length === 0) break;

      cascades += 1;
      const removed = new Set(clusters.flatMap((cluster) => cluster.indexes));
      setWinning(removed);
      playSound("win", soundEnabled);
      await wait(turbo ? 145 : 400);

      if (Math.random() < 0.4) {
        const bomb = BOMB_MULTIPLIERS[Math.floor(Math.random() * BOMB_MULTIPLIERS.length)] ?? 2;
        activeMultiplier += bomb;
        setBombMultiplier(activeMultiplier);
        setMessage(`SUGAR BOMB +${bomb}×`);
        playSound("bonus", soundEnabled);
        await wait(turbo ? 175 : 450);
        setMessage(null);
      }

      total += clusterPayout(clusters, bet) * activeMultiplier;
      setWin(Math.round(total));
      await wait(turbo ? 90 : 210);

      setWinning(new Set());
      current = collapseGrid(current, removed);
      setGrid(current);
      setCascadeIndex(cascades);
      playSound("tick", soundEnabled);
      await wait(turbo ? 160 : 420);
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
      await wait(turbo ? 100 : 290);
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
    if (spinning || autoLeft > 0) return;
    const affordable = [...BET_STEPS].reverse().find((value) => value <= balance);
    if (affordable !== undefined) setBet(affordable);
  };

  const insufficient = bet > balance;

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black sm:px-3 sm:py-2">
      <div className="relative mx-auto aspect-[600/1066] w-full max-w-[470px] overflow-hidden bg-[#31001d] shadow-[0_0_120px_rgba(255,54,187,.3)] sm:rounded-[22px]">
        <img src={candyReference} alt="Candy Cascade" draggable={false} className="absolute inset-0 size-full select-none object-fill" />

        <Link to="/" aria-label="Voltar ao lobby" className="absolute right-[1.1%] top-[.8%] z-50 size-[9.2%] rounded-full bg-transparent" />

        <div className="absolute left-[4%] top-[26.35%] z-20 grid h-[49.7%] w-[93.3%] grid-cols-6 grid-rows-6 overflow-hidden">
          {grid.map((symbol, index) => (
            <div
              key={index}
              className={cn(
                "relative overflow-hidden border border-[#f7bd45]/55 bg-[#480529]",
                spinning && "cc-ref-roll",
                winning.has(index) && "cc-ref-win",
                cascadeIndex > 0 && !spinning && "cc-ref-land",
              )}
            >
              <CandySymbol id={symbol} />
            </div>
          ))}
        </div>

        {message && (
          <div className="cc-ref-bomb absolute left-1/2 top-[48%] z-[70] -translate-x-1/2 whitespace-nowrap rounded-3xl border-2 border-pink-100 bg-[#8e075e]/95 px-6 py-4 text-center text-[clamp(.9rem,4vw,1.2rem)] font-black text-white shadow-[0_0_55px_rgba(255,66,211,.95)]">
            {message}
          </div>
        )}

        <div className="absolute left-[25%] top-[76.4%] z-[35] flex h-[7.7%] w-[50%] items-center justify-center rounded-[20px] bg-[#4a075f]/96 text-center shadow-[inset_0_0_18px_rgba(255,85,238,.4)]">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[.16em] text-pink-100">WIN</p>
            <p className="font-serif text-[clamp(1.25rem,7vw,2.15rem)] font-black leading-none text-[#ffe35f] tabular-nums drop-shadow-[0_2px_0_#6b2b00]">{formatCoins(win)}</p>
            {(cascadeIndex > 0 || bombMultiplier > 1) && <p className="mt-0.5 text-[8px] font-black text-pink-100">CASCADE {cascadeIndex} · SUGAR ×{bombMultiplier}</p>}
          </div>
        </div>

        <div className="absolute left-[3%] top-[85.1%] z-[35] flex h-[5.5%] w-[31%] items-center justify-center rounded-xl bg-[#2b071f]/96 px-1 text-[clamp(.65rem,3vw,.95rem)] font-black text-white tabular-nums">{formatCoins(balance)}</div>
        <div className="absolute right-[3%] top-[85.1%] z-[35] flex h-[5.5%] w-[28%] items-center justify-center rounded-xl bg-[#2b071f]/96 px-1 text-[clamp(.65rem,3vw,.95rem)] font-black text-white tabular-nums">{formatCoins(bet)}</div>

        <button type="button" onClick={() => changeBet(-1)} disabled={spinning || autoLeft > 0} aria-label="Diminuir aposta" className="absolute right-[29.8%] top-[87%] z-50 size-[6.4%] rounded-full disabled:opacity-40" />
        <button type="button" onClick={() => changeBet(1)} disabled={spinning || autoLeft > 0} aria-label="Aumentar aposta" className="absolute right-[1.7%] top-[87%] z-50 size-[6.4%] rounded-full disabled:opacity-40" />

        <button
          type="button"
          onClick={() => void spinRound()}
          disabled={spinning || autoLeft > 0 || insufficient}
          aria-label="Girar"
          className={cn("absolute left-[34.5%] top-[84.1%] z-50 h-[15.1%] w-[31%] rounded-full", !spinning && !insufficient && "cc-ref-spin-ready", "disabled:cursor-not-allowed disabled:opacity-40")}
        />

        <button
          type="button"
          onClick={() => {
            if (autoLeft > 0) {
              autoStopRef.current = true;
              setAutoLeft(0);
            } else {
              void startAuto();
            }
          }}
          aria-label={autoLeft > 0 ? "Parar auto play" : "Auto play"}
          className="absolute left-[8%] top-[93.4%] z-50 h-[5.5%] w-[25%] rounded-xl"
        />

        <button type="button" onClick={setMaxBet} disabled={spinning || autoLeft > 0} aria-label="Aposta máxima" className="absolute right-[8%] top-[93.4%] z-50 h-[5.5%] w-[25%] rounded-xl disabled:opacity-40" />

        <button
          type="button"
          onClick={() => setTurbo((value) => !value)}
          aria-label={turbo ? "Desativar turbo" : "Ativar turbo"}
          className={cn("absolute right-[1.8%] top-[77.4%] z-50 size-[8.5%] rounded-full", turbo && "ring-2 ring-yellow-300 ring-offset-1 ring-offset-transparent")}
        />

        <button type="button" onClick={() => setShowInfo((value) => !value)} aria-label="Informações do jogo" className="absolute left-[1.8%] top-[77.4%] z-50 size-[8.5%] rounded-full" />

        {showInfo && (
          <div className="absolute inset-x-[8%] top-[18%] z-[90] rounded-3xl border border-pink-200/80 bg-[#4a075f]/95 p-4 text-center text-white shadow-[0_12px_60px_rgba(0,0,0,.6)] backdrop-blur">
            <p className="text-base font-black text-yellow-200">CANDY CASCADE</p>
            <p className="mt-1 text-xs leading-relaxed text-pink-50">5 ou mais doces iguais conectados explodem e novos símbolos caem. Sugar Bombs podem aumentar o multiplicador da sequência.</p>
            <button type="button" onClick={() => setShowInfo(false)} className="mt-3 rounded-full border border-pink-100 px-4 py-1.5 text-xs font-black">FECHAR</button>
          </div>
        )}

        {autoLeft > 0 && <div className="absolute left-[26%] top-[94.2%] z-[60] grid size-[6%] place-items-center rounded-full bg-emerald-500 text-[9px] font-black text-white shadow-lg">{autoLeft}</div>}
        {insufficient && <div className="absolute inset-x-[9%] bottom-[9%] z-[80] rounded-full border border-yellow-300 bg-[#4d0732]/95 px-4 py-2 text-center text-[10px] font-black uppercase tracking-wider text-yellow-100">Saldo insuficiente</div>}
      </div>
    </main>
  );
}
