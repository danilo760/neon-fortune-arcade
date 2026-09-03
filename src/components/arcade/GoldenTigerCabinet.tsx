import { Link } from "@tanstack/react-router";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { goldenTigerCabinet } from "@/assets/golden-tiger/cabinetData";
import symbolsArt from "@/assets/golden-tiger/symbols.webp";
import { formatCoins } from "@/lib/arcade/format";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

const BET_STEPS = [10, 50, 100, 200, 500, 1_000, 5_000, 10_000] as const;

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

const CELL_BOXES = [
  { left: 6.15, top: 22.73, width: 28.16, height: 15.55 },
  { left: 35.39, top: 22.73, width: 28.8, height: 15.55 },
  { left: 65.25, top: 22.73, width: 28.69, height: 15.55 },
  { left: 6.15, top: 38.94, width: 28.16, height: 15.61 },
  { left: 35.39, top: 38.94, width: 28.8, height: 15.61 },
  { left: 65.25, top: 38.94, width: 28.69, height: 15.61 },
  { left: 6.15, top: 55.14, width: 28.16, height: 15.55 },
  { left: 35.39, top: 55.14, width: 28.8, height: 15.55 },
  { left: 65.25, top: 55.14, width: 28.69, height: 15.55 },
] as const;

type ArtId = "ingot" | "envelope" | "jade" | "flower" | "tiger" | "coins";
type LetterId = "a" | "k" | "q";
type SymbolId = ArtId | LetterId;

type SymbolDef = {
  id: SymbolId;
  label: string;
  weight: number;
  pay: number;
  sprite?: { x: string; y: string };
  letter?: string;
};

const SYMBOLS: readonly SymbolDef[] = [
  { id: "tiger", label: "Tigrinho Dourado", weight: 5, pay: 10, sprite: { x: "50%", y: "100%" } },
  { id: "ingot", label: "Lingote Dourado", weight: 8, pay: 6, sprite: { x: "0%", y: "0%" } },
  { id: "envelope", label: "Envelope da Sorte", weight: 10, pay: 5, sprite: { x: "50%", y: "0%" } },
  { id: "jade", label: "Amuleto de Jade", weight: 12, pay: 4, sprite: { x: "100%", y: "0%" } },
  { id: "flower", label: "Flor da Fortuna", weight: 14, pay: 3, sprite: { x: "0%", y: "100%" } },
  { id: "coins", label: "Moedas Antigas", weight: 16, pay: 2.5, sprite: { x: "100%", y: "100%" } },
  { id: "a", label: "A", weight: 18, pay: 1.8, letter: "A" },
  { id: "k", label: "K", weight: 20, pay: 1.5, letter: "K" },
  { id: "q", label: "Q", weight: 22, pay: 1.2, letter: "Q" },
];

const BY_ID = new Map<SymbolId, SymbolDef>(SYMBOLS.map((symbol) => [symbol.id, symbol]));
const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
const INITIAL_GRID: SymbolId[] = ["ingot", "envelope", "jade", "flower", "tiger", "coins", "a", "k", "q"];

function pickSymbol(): SymbolId {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const symbol of SYMBOLS) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol.id;
  }
  return "q";
}

function makeGrid(): SymbolId[] {
  return Array.from({ length: 9 }, pickSymbol);
}

function evaluate(grid: readonly SymbolId[], bet: number) {
  let payout = 0;
  let lines = 0;
  const winning = new Set<number>();

  for (const [a, b, c] of WIN_LINES) {
    const first = grid[a];
    const second = grid[b];
    const third = grid[c];
    if (!first || !second || !third || first !== second || second !== third) continue;

    const symbol = BY_ID.get(first);
    if (!symbol) continue;
    payout += bet * symbol.pay;
    lines += 1;
    winning.add(a);
    winning.add(b);
    winning.add(c);
  }

  return { payout: Math.round(payout), lines, winning };
}

function letterStyle(id: LetterId) {
  if (id === "a") return { color: "#b837e7", shadow: "#5f087f" };
  if (id === "k") return { color: "#38d878", shadow: "#08723a" };
  return { color: "#279fe8", shadow: "#075c99" };
}

function DynamicSymbol({ id, spinning, winning }: { id: SymbolId; spinning: boolean; winning: boolean }) {
  const symbol = BY_ID.get(id);
  if (!symbol) return null;

  if (symbol.sprite) {
    return (
      <div
        className={cn(
          "absolute inset-0 bg-[#720d08] bg-no-repeat",
          spinning && "motion-safe:animate-[tiger-reel-spin_210ms_linear_infinite]",
          winning && !spinning && "motion-safe:animate-[tiger-win-cell_850ms_ease-in-out_infinite]",
        )}
        style={{
          backgroundImage: `url(${symbolsArt})`,
          backgroundSize: "300% 200%",
          backgroundPosition: `${symbol.sprite.x} ${symbol.sprite.y}`,
        }}
        aria-label={symbol.label}
      />
    );
  }

  const letter = id as LetterId;
  const colors = letterStyle(letter);
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#a81712,#710c08_55%,#3d0302)]",
        spinning && "motion-safe:animate-[tiger-reel-spin_210ms_linear_infinite]",
        winning && !spinning && "motion-safe:animate-[tiger-win-cell_850ms_ease-in-out_infinite]",
      )}
      aria-label={symbol.label}
    >
      <span
        className="font-serif text-[clamp(3rem,15vw,5.7rem)] font-black leading-none"
        style={{
          color: colors.color,
          WebkitTextStroke: "2px #ffd75d",
          textShadow: `0 5px 0 ${colors.shadow}, 0 8px 12px rgba(0,0,0,.45)`,
        }}
      >
        {symbol.letter}
      </span>
    </div>
  );
}

export function GoldenTigerCabinet() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const [bet, setBet] = useState<number>(200);
  const [grid, setGrid] = useState<SymbolId[]>(INITIAL_GRID);
  const [win, setWin] = useState(0);
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [spinning, setSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const busyRef = useRef(false);
  const stopRef = useRef(false);

  useEffect(() => hydrateFromStorage(), []);

  const spin = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    if (!arcadeActions.placeBet(bet)) {
      playSound("lose", soundEnabled);
      return false;
    }

    busyRef.current = true;
    setHasSpun(true);
    setSpinning(true);
    setWin(0);
    setWinning(new Set());
    playSound("spin", soundEnabled);

    const finalGrid = makeGrid();
    const result = evaluate(finalGrid, bet);
    const duration = turbo ? 430 : 980;
    const interval = window.setInterval(() => {
      setGrid(makeGrid());
      playSound("tick", soundEnabled);
    }, turbo ? 55 : 82);

    await new Promise<void>((resolve) => window.setTimeout(resolve, duration));
    window.clearInterval(interval);
    setGrid(finalGrid);

    if (result.payout > 0) arcadeActions.credit(result.payout);
    arcadeActions.recordRound({
      slug: "golden-tiger",
      gameName: "Golden Tiger",
      bet,
      payout: result.payout,
      multiplier: result.payout > 0 ? result.payout / bet : 0,
      note: `${result.lines} linha${result.lines === 1 ? "" : "s"} vencedora${result.lines === 1 ? "" : "s"} · 8 linhas`,
    });

    setWin(result.payout);
    setWinning(result.winning);
    setSpinning(false);
    busyRef.current = false;
    playSound(result.payout >= bet * 10 ? "bigWin" : result.payout > 0 ? "win" : "lose", soundEnabled);
    return true;
  }, [bet, soundEnabled, turbo]);

  const startAuto = useCallback(async () => {
    if (busyRef.current || autoLeft > 0) return;
    stopRef.current = false;
    for (let remaining = 10; remaining > 0; remaining -= 1) {
      if (stopRef.current) break;
      setAutoLeft(remaining);
      const played = await spin();
      if (!played) break;
      await new Promise<void>((resolve) => window.setTimeout(resolve, turbo ? 220 : 430));
    }
    setAutoLeft(0);
  }, [autoLeft, spin, turbo]);

  const betIndex = BET_STEPS.findIndex((value) => value === bet);
  const insufficient = bet > balance;

  const changeBet = (direction: -1 | 1) => {
    if (spinning || autoLeft > 0) return;
    const safeIndex = betIndex < 0 ? 0 : betIndex;
    const nextIndex = Math.max(0, Math.min(BET_STEPS.length - 1, safeIndex + direction));
    const nextBet = BET_STEPS[nextIndex];
    if (nextBet !== undefined) setBet(nextBet);
  };

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#050302] sm:px-4 sm:py-3">
      <div className="relative mx-auto aspect-[941/1672] w-full max-w-[430px] overflow-hidden bg-black shadow-[0_0_90px_rgba(0,0,0,.95)] sm:rounded-[24px] sm:ring-1 sm:ring-yellow-500/25">
        <img
          src={goldenTigerCabinet}
          alt="Golden Tiger, máquina premium de arcade com tigrinho, templo dourado e rolos 3 por 3"
          className="absolute inset-0 size-full select-none object-fill"
          draggable={false}
        />

        <div className="absolute left-[1.4%] top-[1.1%] z-50 flex gap-1.5">
          <Link
            to="/"
            aria-label="Voltar ao lobby"
            className="flex size-8 items-center justify-center rounded-full border border-yellow-300/80 bg-black/65 text-yellow-100 shadow-lg backdrop-blur-sm transition hover:bg-black/80"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => arcadeActions.toggleSound()}
            aria-label={soundEnabled ? "Desativar som" : "Ativar som"}
            className="flex size-8 items-center justify-center rounded-full border border-yellow-300/80 bg-black/65 text-yellow-100 shadow-lg backdrop-blur-sm transition hover:bg-black/80"
          >
            {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
        </div>

        {(hasSpun || spinning) &&
          grid.map((id, index) => {
            const box = CELL_BOXES[index];
            if (!box) return null;
            return (
              <div
                key={`${index}-${id}`}
                className={cn(
                  "absolute z-20 overflow-hidden bg-[#720d08]",
                  winning.has(index) && !spinning && "ring-2 ring-inset ring-yellow-200 shadow-[0_0_28px_rgba(255,216,75,.9)]",
                )}
                style={{
                  left: `${box.left}%`,
                  top: `${box.top}%`,
                  width: `${box.width}%`,
                  height: `${box.height}%`,
                }}
              >
                <DynamicSymbol id={id} spinning={spinning} winning={winning.has(index)} />
              </div>
            );
          })}

        {hasSpun && (
          <div
            className={cn(
              "absolute z-30 flex items-center justify-center rounded-[18%] bg-[radial-gradient(ellipse_at_center,#087b42,#034326_72%)] px-2 text-center shadow-[inset_0_0_14px_rgba(255,214,79,.15)]",
              win > 0 && !spinning && "motion-safe:animate-[tiger-win-banner_900ms_ease-in-out_infinite]",
            )}
            style={{ left: "27.2%", top: "74.6%", width: "45.6%", height: "4.45%" }}
            role="status"
            aria-live="polite"
          >
            <span className="font-serif text-[clamp(1.3rem,6.6vw,2rem)] font-black tabular-nums text-[#ffd74f] drop-shadow-[0_2px_0_#704000]">
              {formatCoins(win)}
            </span>
          </div>
        )}

        <div
          className="absolute z-30 flex items-center justify-center bg-[#170b08] px-1 text-center"
          style={{ left: "5.2%", top: "84.45%", width: "26.8%", height: "3.75%" }}
        >
          <span className="text-[clamp(.78rem,4.4vw,1.12rem)] font-bold tabular-nums text-white">{formatCoins(balance)}</span>
        </div>

        <div
          className="absolute z-30 flex items-center justify-center bg-[#170b08] px-1 text-center"
          style={{ left: "68.25%", top: "84.45%", width: "25.6%", height: "3.75%" }}
        >
          <span className="text-[clamp(.78rem,4.4vw,1.12rem)] font-bold tabular-nums text-white">{formatCoins(bet)}</span>
        </div>

        <button
          type="button"
          onClick={() => setTurbo((value) => !value)}
          aria-label="Alternar modo turbo"
          aria-pressed={turbo}
          title={`Turbo ${turbo ? "ligado" : "desligado"}`}
          className={cn(
            "absolute z-40 rounded-full transition active:scale-95",
            turbo && "shadow-[0_0_25px_rgba(255,222,66,.95)] ring-2 ring-yellow-200/90",
          )}
          style={{ left: "87.1%", top: "74.65%", width: "9.3%", height: "5.25%" }}
        />

        <button
          type="button"
          aria-label="Informações: oito linhas premiadas"
          title="8 linhas: 3 horizontais, 3 verticais e 2 diagonais"
          className="absolute z-40 rounded-full transition active:scale-95"
          style={{ left: "3.4%", top: "74.65%", width: "9.3%", height: "5.25%" }}
        />

        <button
          type="button"
          onClick={() => changeBet(-1)}
          disabled={spinning || autoLeft > 0}
          aria-label="Diminuir aposta"
          className="absolute z-40 rounded-full disabled:cursor-not-allowed"
          style={{ left: "66.2%", top: "84.3%", width: "7.8%", height: "4.55%" }}
        />
        <button
          type="button"
          onClick={() => changeBet(1)}
          disabled={spinning || autoLeft > 0}
          aria-label="Aumentar aposta"
          className="absolute z-40 rounded-full disabled:cursor-not-allowed"
          style={{ left: "90.35%", top: "84.3%", width: "7.8%", height: "4.55%" }}
        />

        <button
          type="button"
          onClick={() => void spin()}
          disabled={spinning || autoLeft > 0 || insufficient}
          aria-label="Girar Golden Tiger"
          className={cn(
            "absolute z-40 rounded-full transition duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-55",
            spinning
              ? "shadow-[0_0_34px_rgba(86,255,104,.9)] ring-4 ring-yellow-200/70"
              : "motion-safe:animate-[tiger-spin-pulse_1.8s_ease-in-out_infinite]",
          )}
          style={{ left: "32.2%", top: "81.05%", width: "35.7%", height: "17.9%" }}
        />

        {autoLeft > 0 ? (
          <button
            type="button"
            onClick={() => {
              stopRef.current = true;
            }}
            aria-label={`Parar auto play, ${autoLeft} giros restantes`}
            className="absolute z-40 rounded-xl bg-black/15 ring-2 ring-inset ring-emerald-300/80"
            style={{ left: "4.4%", top: "91.0%", width: "26.6%", height: "5.55%" }}
          >
            <span className="absolute right-1 top-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow">{autoLeft}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startAuto()}
            disabled={spinning || insufficient}
            aria-label="Auto play de dez giros"
            className="absolute z-40 rounded-xl transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ left: "4.4%", top: "91.0%", width: "26.6%", height: "5.55%" }}
          />
        )}

        <button
          type="button"
          onClick={() => setBet(10_000)}
          disabled={spinning || autoLeft > 0}
          aria-label="Aposta máxima"
          className="absolute z-40 rounded-xl transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ left: "69.2%", top: "91.0%", width: "26.2%", height: "5.55%" }}
        />

        {insufficient && (
          <div className="absolute inset-x-[8%] bottom-[1.2%] z-50 rounded-xl border border-red-300/80 bg-red-950/95 px-3 py-2 text-center text-[11px] font-semibold text-red-50 shadow-2xl">
            Saldo fictício insuficiente. Recarregue moedas grátis no lobby.
          </div>
        )}
      </div>
    </main>
  );
}
