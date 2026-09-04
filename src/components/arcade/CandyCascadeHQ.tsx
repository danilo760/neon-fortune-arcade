import { Link } from "@tanstack/react-router";

import { AnimatedWinCounter } from "./AnimatedWinCounter";
import { useCallback, useEffect, useRef, useState } from "react";

import candyReference from "@/assets/candy-cascade/reference-hd.webp";
import {
  makeCandyGrid,
  planCandyRound,
  type CandyBombEvent,
  type CandySymbolId,
} from "@/lib/arcade/candyCascadeMath";
import { formatCoins } from "@/lib/arcade/format";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import "./CandyCascadeReference.css";

type Crop = { x: number; y: number; w: number; h: number };
type Phase = "idle" | "spinning" | "cluster" | "bombBirth" | "bombBurst" | "falling" | "settled";

const FULL_W = 600;
const FULL_H = 1066;
const COLS = 6;
const ROWS = 5;
const BET_STEPS = [10, 50, 100, 200, 500, 1_000, 5_000, 10_000] as const;

const CROPS: Record<CandySymbolId, Crop> = {
  lollipop: { x: 24, y: 281, w: 93, h: 87 },
  star: { x: 118, y: 281, w: 93, h: 87 },
  jelly: { x: 212, y: 281, w: 92, h: 87 },
  candy: { x: 305, y: 281, w: 93, h: 87 },
  cupcake: { x: 399, y: 281, w: 92, h: 87 },
  heart: { x: 399, y: 369, w: 92, h: 87 },
  sprinkle: { x: 212, y: 457, w: 92, h: 87 },
  diamond: { x: 305, y: 457, w: 93, h: 87 },
};

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function CandySymbol({ id }: { id: CandySymbolId }) {
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

function BombOnGrid({ bomb, phase }: { bomb: CandyBombEvent; phase: Phase }) {
  const row = Math.floor(bomb.index / COLS);
  const column = bomb.index % COLS;
  return (
    <div
      className={cn("cc-grid-bomb", phase === "bombBurst" && "is-bursting")}
      style={{ left: `${column * (100 / COLS)}%`, top: `${row * (100 / ROWS)}%` }}
      aria-hidden
    >
      <span className="cc-grid-bomb__core">×{bomb.multiplier}</span>
      <span className="cc-grid-bomb__sugar" />
    </div>
  );
}

export function CandyCascadeHQ() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const [bet, setBet] = useState<number>(200);
  const [grid, setGrid] = useState<CandySymbolId[]>(() => makeCandyGrid());
  const [win, setWin] = useState(0);
  const [winDuration, setWinDuration] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [cascadeIndex, setCascadeIndex] = useState(0);
  const [sugarMultiplier, setSugarMultiplier] = useState(1);
  const [activeBomb, setActiveBomb] = useState<CandyBombEvent | null>(null);
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
    setPhase("spinning");
    setWinning(new Set());
    setCascadeIndex(0);
    setSugarMultiplier(1);
    setActiveBomb(null);
    setWinDuration(0);
    setWin(0);
    playSound("spin", soundEnabled);

    // Resultado completo é preparado antes da coreografia.
    const plan = planCandyRound(bet);
    for (let step = 0; step < (turbo ? 4 : 8); step += 1) {
      setGrid(makeCandyGrid());
      await wait(turbo ? 38 : 62);
    }
    setGrid(plan.initialGrid);
    await wait(turbo ? 70 : 170);

    let displayed = 0;
    for (let index = 0; index < plan.cascades.length; index += 1) {
      const cascade = plan.cascades[index];
      if (!cascade) continue;

      setGrid(cascade.grid);
      setCascadeIndex(index + 1);
      setWinning(new Set(cascade.winning));
      setPhase("cluster");
      playSound("candyPop", soundEnabled);
      await wait(turbo ? 120 : Math.min(300 + index * 45, 480));
      playSound("candyBreak", soundEnabled);

      if (cascade.bomb) {
        setActiveBomb(cascade.bomb);
        setPhase("bombBirth");
        playSound("candyBomb", soundEnabled);
        await wait(turbo ? 160 : 390);
        setSugarMultiplier(cascade.sugarMultiplier);
        setPhase("bombBurst");
        playSound("candyExplosion", soundEnabled);
        await wait(turbo ? 120 : 300);
      } else {
        setSugarMultiplier(cascade.sugarMultiplier);
      }

      const target = displayed + cascade.payout;
      const winDuration = turbo ? 120 : 340;
      setWinDuration(winDuration);
      setWin(target);
      await wait(winDuration);
      displayed = target;

      setWinning(new Set());
      setActiveBomb(null);
      setPhase("falling");
      setGrid(cascade.nextGrid);
      playSound(index >= 2 ? "candyStreak" : "candyBounce", soundEnabled);
      await wait(turbo ? 130 : 330);
    }

    setGrid(plan.finalGrid);
    setPhase("settled");
    const payout = plan.payout;
    if (payout > 0) arcadeActions.credit(payout);
    arcadeActions.recordRound({
      slug: "candy-cascade",
      gameName: "Candy Cascade",
      bet,
      payout,
      multiplier: payout > 0 ? payout / bet : 0,
      note: `${plan.cascades.length} cascata(s) · ${plan.bombs} Sugar Bomb(s) · sugar ×${sugarMultiplier}`,
    });
    playSound(payout >= bet * 10 ? "bigWin" : payout > 0 ? "win" : "lose", soundEnabled);
    await wait(turbo ? 90 : 210);
    setPhase("idle");
    setSpinning(false);
    busyRef.current = false;
    return true;
  }, [bet, soundEnabled, sugarMultiplier, turbo]);

  const startAuto = useCallback(async () => {
    if (busyRef.current || autoLeft > 0) return;
    autoStopRef.current = false;
    for (let left = 10; left > 0; left -= 1) {
      if (autoStopRef.current) break;
      setAutoLeft(left);
      const played = await spinRound();
      if (!played) break;
      await wait(turbo ? 100 : 260);
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
      <div className={cn("cc-machine relative mx-auto aspect-[600/1066] w-full max-w-[430px] overflow-hidden bg-[#31001d] shadow-[0_0_120px_rgba(255,54,187,.3)] sm:rounded-[22px]", cascadeIndex >= 3 && spinning && "cc-machine--streak")}>
        <img src={candyReference} alt="Candy Cascade" draggable={false} className="absolute inset-0 size-full select-none object-fill" />
        <Link to="/" aria-label="Voltar ao lobby" className="absolute right-[1.1%] top-[.8%] z-50 size-[9.2%] rounded-full bg-transparent" />

        <div className={cn("cc-grid absolute left-[4%] top-[28.3%] z-20 grid h-[45.8%] w-[93.3%] grid-cols-6 grid-rows-5 overflow-hidden", phase === "spinning" && "is-spinning", phase === "falling" && "is-falling", phase === "bombBurst" && "is-bomb-impact")}>
          {grid.map((symbol, index) => (
            <div key={index} className={cn("cc-cell relative overflow-hidden border border-[#f7bd45]/55 bg-[#480529]", winning.has(index) && "cc-ref-win")}>
              <CandySymbol id={symbol} />
            </div>
          ))}
          {activeBomb && <BombOnGrid bomb={activeBomb} phase={phase} />}
        </div>

        <div className={cn("absolute left-[25%] top-[76.4%] z-[35] flex h-[7.7%] w-[50%] items-center justify-center rounded-[20px] bg-[#4a075f]/96 text-center shadow-[inset_0_0_18px_rgba(255,85,238,.4)]", win > 0 && !spinning && "cc-ref-result-win")}>
          <div>
            <p className="text-[8px] font-black uppercase tracking-[.16em] text-pink-100">{spinning && cascadeIndex > 0 ? `CASCADE ${cascadeIndex}` : "WIN"}</p>
            <p className="font-serif text-[clamp(1.25rem,7vw,2.15rem)] font-black leading-none text-[#ffe35f] tabular-nums drop-shadow-[0_2px_0_#6b2b00]"><AnimatedWinCounter value={win} duration={winDuration} /></p>
            {(cascadeIndex > 0 || sugarMultiplier > 1) && <p className="mt-0.5 text-[8px] font-black text-pink-100">SUGAR ×{sugarMultiplier}</p>}
          </div>
        </div>

        <div className="absolute left-[3%] top-[85.1%] z-[35] flex h-[5.5%] w-[31%] items-center justify-center rounded-xl bg-[#2b071f]/96 px-1 text-[clamp(.65rem,3vw,.95rem)] font-black text-white tabular-nums">{formatCoins(balance)}</div>
        <div className="absolute right-[3%] top-[85.1%] z-[35] flex h-[5.5%] w-[28%] items-center justify-center rounded-xl bg-[#2b071f]/96 px-1 text-[clamp(.65rem,3vw,.95rem)] font-black text-white tabular-nums">{formatCoins(bet)}</div>
        <button type="button" onClick={() => changeBet(-1)} disabled={spinning || autoLeft > 0} aria-label="Diminuir aposta" className="absolute right-[29.8%] top-[87%] z-50 size-[6.4%] rounded-full disabled:opacity-40" />
        <button type="button" onClick={() => changeBet(1)} disabled={spinning || autoLeft > 0} aria-label="Aumentar aposta" className="absolute right-[1.7%] top-[87%] z-50 size-[6.4%] rounded-full disabled:opacity-40" />
        <button type="button" onClick={() => void spinRound()} disabled={spinning || autoLeft > 0 || insufficient} aria-label="Girar Candy Cascade" aria-busy={spinning} className={cn("absolute left-[34.5%] top-[84.1%] z-50 h-[15.1%] w-[31%] rounded-full disabled:cursor-not-allowed disabled:opacity-40", !spinning && !insufficient && "cc-ref-spin-ready")} />
        <button type="button" onClick={() => { if (autoLeft > 0) { autoStopRef.current = true; } else { void startAuto(); } }} aria-label={autoLeft > 0 ? "Parar auto play" : "Auto play"} className="absolute left-[8%] top-[93.4%] z-50 h-[5.5%] w-[25%] rounded-xl" />
        <button type="button" onClick={setMaxBet} disabled={spinning || autoLeft > 0} aria-label="Aposta máxima" className="absolute right-[8%] top-[93.4%] z-50 h-[5.5%] w-[25%] rounded-xl disabled:opacity-40" />
        <button type="button" onClick={() => setTurbo((value) => !value)} aria-label={turbo ? "Desativar turbo" : "Ativar turbo"} aria-pressed={turbo} className={cn("absolute right-[1.8%] top-[77.4%] z-50 size-[8.5%] rounded-full", turbo && "ring-2 ring-yellow-300 ring-offset-1 ring-offset-transparent")} />
        <button type="button" onClick={() => setShowInfo((value) => !value)} aria-label="Informações do jogo" className="absolute left-[1.8%] top-[77.4%] z-50 size-[8.5%] rounded-full" />

        {showInfo && (
          <div className="absolute inset-x-[8%] top-[18%] z-[90] rounded-3xl border border-pink-200/80 bg-[#4a075f]/95 p-4 text-center text-white shadow-[0_12px_60px_rgba(0,0,0,.6)] backdrop-blur">
            <p className="text-base font-black text-yellow-200">CANDY CASCADE</p>
            <p className="mt-1 text-xs leading-relaxed text-pink-50">Grade 6×5. Cinco ou mais doces conectados explodem. Clusters grandes e cascatas longas podem criar Sugar Bombs diretamente na grade.</p>
            <button type="button" onClick={() => setShowInfo(false)} className="mt-3 rounded-full border border-pink-100 px-4 py-1.5 text-xs font-black">FECHAR</button>
          </div>
        )}

        {autoLeft > 0 && <div className="absolute left-[26%] top-[94.2%] z-[60] grid size-[6%] place-items-center rounded-full bg-emerald-500 text-[9px] font-black text-white shadow-lg">{autoLeft}</div>}
        {insufficient && <div className="absolute inset-x-[9%] bottom-[9%] z-[80] rounded-full border border-yellow-300 bg-[#4d0732]/95 px-4 py-2 text-center text-[10px] font-black uppercase tracking-wider text-yellow-100">Saldo insuficiente</div>}
      </div>
    </main>
  );
}
