import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { olympusStormReferenceBase64 } from "@/assets/olympus-storm/referenceData";
import { formatCoins } from "@/lib/arcade/format";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import "./OlympusStormReference.css";

type SymbolId = "bolt" | "crown" | "chalice" | "coin" | "hammer" | "orb" | "zeus";
type Crop = { x: number; y: number; w: number; h: number };
type SymbolDef = { id: SymbolId; weight: number; pay: number };
type SpinResult = {
  payout: number;
  basePayout: number;
  multiplier: number;
  lines: number;
  winning: Set<number>;
};

const FULL_W = 941;
const FULL_H = 1672;

const CROPS: Record<SymbolId, Crop> = {
  bolt: { x: 75, y: 414, w: 258, h: 235 },
  crown: { x: 333, y: 414, w: 257, h: 235 },
  chalice: { x: 590, y: 414, w: 264, h: 235 },
  coin: { x: 75, y: 650, w: 258, h: 234 },
  hammer: { x: 333, y: 650, w: 257, h: 234 },
  orb: { x: 590, y: 650, w: 264, h: 234 },
  zeus: { x: 333, y: 884, w: 257, h: 233 },
};

const SYMBOLS: readonly SymbolDef[] = [
  { id: "zeus", weight: 5, pay: 16 },
  { id: "bolt", weight: 8, pay: 10 },
  { id: "crown", weight: 10, pay: 7 },
  { id: "chalice", weight: 12, pay: 5 },
  { id: "hammer", weight: 14, pay: 4 },
  { id: "orb", weight: 16, pay: 3 },
  { id: "coin", weight: 18, pay: 2.2 },
];

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
const SYMBOL_BY_ID = new Map(SYMBOLS.map((symbol) => [symbol.id, symbol]));
const BET_STEPS = [10, 50, 100, 200, 500, 1_000, 5_000, 10_000] as const;
const STORM_MULTIPLIERS = [2, 3, 5] as const;

// 4 horizontais + 2 diagonais, todas da esquerda para a direita.
const PAYLINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [9, 10, 11],
  [0, 4, 8],
  [9, 7, 5],
] as const;

const INITIAL_GRID: SymbolId[] = [
  "bolt", "crown", "chalice",
  "coin", "hammer", "orb",
  "crown", "zeus", "bolt",
  "orb", "coin", "chalice",
];

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function pickSymbol(): SymbolId {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const symbol of SYMBOLS) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol.id;
  }
  return "coin";
}

function makeGrid(): SymbolId[] {
  return Array.from({ length: 12 }, pickSymbol);
}

function evaluate(grid: readonly SymbolId[], bet: number): SpinResult {
  let basePayout = 0;
  let lines = 0;
  const winning = new Set<number>();

  for (const line of PAYLINES) {
    const a = line[0];
    const b = line[1];
    const c = line[2];
    const first = grid[a];
    const second = grid[b];
    const third = grid[c];
    if (!first || !second || !third) continue;

    const nonWild = [first, second, third].find((symbol) => symbol !== "zeus") ?? "zeus";
    const matches = [first, second, third].every(
      (symbol) => symbol === nonWild || symbol === "zeus",
    );
    if (!matches) continue;

    const def = SYMBOL_BY_ID.get(nonWild) ?? SYMBOL_BY_ID.get("zeus");
    if (!def) continue;
    basePayout += bet * def.pay;
    lines += 1;
    winning.add(a);
    winning.add(b);
    winning.add(c);
  }

  const multiplier = basePayout > 0 && Math.random() < 0.3
    ? (STORM_MULTIPLIERS[Math.floor(Math.random() * STORM_MULTIPLIERS.length)] ?? 2)
    : 1;
  const payout = Math.round(basePayout * multiplier);
  return { payout, basePayout: Math.round(basePayout), multiplier, lines, winning };
}

function useReferenceBlob() {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    try {
      if (olympusStormReferenceBase64.length < 83_000) throw new Error("asset incompleto");
      const binary = window.atob(olympusStormReferenceBase64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
      setSrc(objectUrl);
    } catch {
      setFailed(true);
    }

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return { src, failed };
}

function ReferenceSymbol({ id, src }: { id: SymbolId; src: string }) {
  const crop = CROPS[id];
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#031735]">
      <img
        src={src}
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

export function OlympusStormReference() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const { src, failed } = useReferenceBlob();

  const [bet, setBet] = useState<number>(200);
  const [grid, setGrid] = useState<SymbolId[]>(INITIAL_GRID);
  const [win, setWin] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [stoppedColumns, setStoppedColumns] = useState(3);
  const [landingColumn, setLandingColumn] = useState(-1);
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [stormMultiplier, setStormMultiplier] = useState(1);
  const [stormMessage, setStormMessage] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);

  const busyRef = useRef(false);
  const stoppedRef = useRef(3);
  const autoStopRef = useRef(false);

  useEffect(() => hydrateFromStorage(), []);

  const spinRound = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    if (!arcadeActions.placeBet(bet)) {
      playSound("lose", soundEnabled);
      return false;
    }

    busyRef.current = true;
    setSpinning(true);
    setStoppedColumns(0);
    stoppedRef.current = 0;
    setLandingColumn(-1);
    setWinning(new Set());
    setStormMultiplier(1);
    setStormMessage(null);
    setWin(0);
    playSound("spin", soundEnabled);

    // O resultado é definido antes da animação; depois apenas revelado.
    const finalGrid = makeGrid();
    const result = evaluate(finalGrid, bet);

    const rolling = window.setInterval(() => {
      setGrid((current) =>
        current.map((symbol, index) => (index % 3 < stoppedRef.current ? symbol : pickSymbol())),
      );
    }, turbo ? 42 : 68);

    await wait(turbo ? 170 : 480);

    for (let column = 0; column < 3; column += 1) {
      setGrid((current) =>
        current.map((symbol, index) =>
          index % 3 === column ? (finalGrid[index] ?? symbol) : symbol,
        ),
      );
      stoppedRef.current = column + 1;
      setStoppedColumns(column + 1);
      setLandingColumn(column);
      playSound("tick", soundEnabled);
      await wait(turbo ? 90 : 230);
    }

    window.clearInterval(rolling);
    setGrid(finalGrid);
    setStoppedColumns(3);
    stoppedRef.current = 3;
    setLandingColumn(-1);
    setSpinning(false);
    setWinning(result.winning);
    setWin(result.payout);
    setStormMultiplier(result.multiplier);

    if (result.payout > 0) {
      arcadeActions.credit(result.payout);
      setFlashKey((value) => value + 1);
      if (result.multiplier > 1) {
        setStormMessage(`STORM ×${result.multiplier}`);
        playSound("bonus", soundEnabled);
        await wait(turbo ? 430 : 850);
        setStormMessage(null);
      }
    }

    arcadeActions.recordRound({
      slug: "olympus-storm",
      gameName: "Olympus Storm",
      bet,
      payout: result.payout,
      multiplier: result.payout > 0 ? result.payout / bet : 0,
      note: `${result.lines} linha(s) · tempestade ×${result.multiplier}`,
    });

    playSound(
      result.payout >= bet * 10 ? "bigWin" : result.payout > 0 ? "win" : "lose",
      soundEnabled,
    );
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
      await wait(turbo ? 120 : 300);
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
      <div className="relative mx-auto aspect-[941/1672] w-full max-w-[430px] overflow-hidden bg-[#021329] shadow-[0_0_100px_rgba(20,106,255,.16)] sm:rounded-[22px]">
        {src ? (
          <img
            src={src}
            alt="Olympus Storm"
            draggable={false}
            className="absolute inset-0 size-full select-none object-fill"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[#021329] p-8 text-center font-bold text-blue-100">
            {failed ? "Falha ao carregar a arte do Olympus Storm." : "Carregando Olympus Storm…"}
          </div>
        )}

        <Link
          to="/"
          aria-label="Voltar ao lobby"
          className="absolute right-[1.8%] top-[1.2%] z-50 size-[9%] rounded-full bg-transparent"
        />

        {src && (
          <div className="absolute left-[7.95%] top-[24.76%] z-20 grid h-[53.05%] w-[82.9%] grid-cols-3 grid-rows-4 overflow-hidden">
            {grid.map((symbol, index) => {
              const column = index % 3;
              const isRolling = spinning && column >= stoppedColumns;
              const isLanding = spinning && landingColumn === column;
              return (
                <div
                  key={index}
                  className={cn(
                    "relative overflow-hidden border border-[#f5bd37]/60 bg-[#031735]",
                    isRolling && "os-ref-spinning",
                    isLanding && "os-ref-land",
                    !spinning && winning.has(index) && "os-ref-win",
                  )}
                >
                  <ReferenceSymbol id={symbol} src={src} />
                </div>
              );
            })}
          </div>
        )}

        {flashKey > 0 && <div key={flashKey} className="os-ref-lightning-flash absolute inset-0 z-40 pointer-events-none" />}

        {stormMessage && (
          <div className="os-ref-storm-message absolute left-1/2 top-[43%] z-[65] -translate-x-1/2 rounded-2xl border-2 border-cyan-100 bg-[#001d4d]/92 px-5 py-3 text-center font-serif text-3xl font-black text-white shadow-[0_0_38px_rgba(50,185,255,.95)]">
            {stormMessage}
          </div>
        )}

        {win >= bet * 10 && !spinning && (
          <div className="os-ref-big-win pointer-events-none absolute left-1/2 top-[43%] z-[64] -translate-x-1/2 rounded-2xl border-2 border-yellow-100 bg-[#071b58]/94 px-5 py-3 text-center font-serif text-3xl font-black text-yellow-100 shadow-[0_0_42px_rgba(95,205,255,.82)]">
            BIG WIN
          </div>
        )}

        <div className="absolute left-[25.5%] top-[77.7%] z-35 flex h-[6.5%] w-[49%] items-center justify-center rounded-[18px] bg-[#002a62]/95 px-2 text-center shadow-[inset_0_0_12px_rgba(70,175,255,.45)]">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[.18em] text-blue-200">WIN</p>
            <p className="font-serif text-[clamp(1.1rem,7vw,2rem)] font-black leading-none text-[#ffd95b] tabular-nums drop-shadow-[0_2px_0_#5b3100]">
              {formatCoins(win)}
            </p>
            {stormMultiplier > 1 && !spinning && (
              <p className="mt-0.5 text-[8px] font-black text-cyan-200">STORM ×{stormMultiplier}</p>
            )}
          </div>
        </div>

        <div className="absolute left-[3.2%] top-[85.1%] z-35 flex h-[4.2%] w-[27.5%] items-center justify-center rounded-lg bg-[#021b3a]/95 px-1 font-black text-white tabular-nums">
          {formatCoins(balance)}
        </div>
        <div className="absolute right-[3.1%] top-[85.1%] z-35 flex h-[4.2%] w-[23.5%] items-center justify-center rounded-lg bg-[#021b3a]/95 px-1 font-black text-white tabular-nums">
          {formatCoins(bet)}
        </div>

        <button
          type="button"
          onClick={() => changeBet(-1)}
          disabled={spinning || autoLeft > 0}
          aria-label="Diminuir aposta"
          className="absolute right-[27.8%] top-[84.3%] z-50 size-[7%] rounded-full disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() => changeBet(1)}
          disabled={spinning || autoLeft > 0}
          aria-label="Aumentar aposta"
          className="absolute right-[1.2%] top-[84.3%] z-50 size-[7%] rounded-full disabled:opacity-40"
        />

        <button
          type="button"
          onClick={() => setTurbo((value) => !value)}
          aria-label="Alternar turbo"
          aria-pressed={turbo}
          className={cn(
            "absolute right-[1.3%] top-[78.1%] z-50 size-[8.8%] rounded-full",
            turbo && "ring-2 ring-cyan-100 shadow-[0_0_25px_#45c8ff]",
          )}
        />

        {autoLeft > 0 ? (
          <button
            type="button"
            onClick={() => { autoStopRef.current = true; }}
            aria-label="Parar auto play"
            className="absolute left-[4.5%] top-[92.6%] z-50 h-[5.7%] w-[25%] rounded-xl"
          >
            <span className="absolute right-0 top-0 rounded-full bg-cyan-500 px-1.5 text-[9px] font-black text-white">{autoLeft}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startAuto()}
            disabled={spinning || insufficient || !src}
            aria-label="Auto play"
            className="absolute left-[4.5%] top-[92.6%] z-50 h-[5.7%] w-[25%] rounded-xl disabled:opacity-40"
          />
        )}

        <button
          type="button"
          onClick={setMaxBet}
          disabled={spinning || autoLeft > 0}
          aria-label="Aposta máxima"
          className="absolute right-[4.4%] top-[92.6%] z-50 h-[5.7%] w-[25.5%] rounded-xl disabled:opacity-40"
        />

        <button
          type="button"
          onClick={() => void spinRound()}
          disabled={spinning || autoLeft > 0 || insufficient || !src}
          aria-label="Girar Olympus Storm"
          className={cn(
            "os-ref-spin-button absolute left-[35.5%] top-[85.1%] z-50 size-[29%] rounded-full disabled:cursor-not-allowed disabled:opacity-45",
            spinning && "scale-95",
          )}
        />

        {insufficient && (
          <div className="absolute inset-x-[12%] bottom-[.6%] z-[70] rounded-xl border border-blue-200/70 bg-blue-950/95 px-3 py-2 text-center text-[10px] font-bold text-blue-50">
            Saldo fictício insuficiente — recarregue moedas grátis no lobby.
          </div>
        )}
        <div className="absolute inset-x-0 bottom-[.15%] z-20 text-center text-[7px] font-black tracking-[.16em] text-blue-100/70">
          MOEDAS FICTÍCIAS · SEM VALOR REAL
        </div>
      </div>
    </main>
  );
}
