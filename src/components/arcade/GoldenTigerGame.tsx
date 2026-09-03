import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bolt,
  Info,
  Minus,
  Plus,
  RotateCw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatCoins, formatMultiplier } from "@/lib/arcade/format";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

const BET_STEPS = [10, 50, 100, 500, 1_000, 5_000, 10_000] as const;

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

type ArtSymbolId = "ingot" | "envelope" | "jade" | "flower" | "tiger" | "coins";
type LetterSymbolId = "a" | "k" | "q";
type SymbolId = ArtSymbolId | LetterSymbolId;

type SymbolDefinition = {
  id: SymbolId;
  label: string;
  weight: number;
  pay: number;
  sprite?: { x: string; y: string };
  letter?: string;
};

const SYMBOLS: readonly SymbolDefinition[] = [
  {
    id: "tiger",
    label: "Tigrinho Dourado",
    weight: 5,
    pay: 10,
    sprite: { x: "50%", y: "100%" },
  },
  {
    id: "ingot",
    label: "Lingote da Sorte",
    weight: 8,
    pay: 6,
    sprite: { x: "0%", y: "0%" },
  },
  {
    id: "envelope",
    label: "Envelope Imperial",
    weight: 10,
    pay: 5,
    sprite: { x: "50%", y: "0%" },
  },
  {
    id: "jade",
    label: "Jade Celestial",
    weight: 12,
    pay: 4,
    sprite: { x: "100%", y: "0%" },
  },
  {
    id: "flower",
    label: "Flor da Fortuna",
    weight: 14,
    pay: 3,
    sprite: { x: "0%", y: "100%" },
  },
  {
    id: "coins",
    label: "Moedas Antigas",
    weight: 16,
    pay: 2.5,
    sprite: { x: "100%", y: "100%" },
  },
  { id: "a", label: "A", weight: 18, pay: 1.8, letter: "A" },
  { id: "k", label: "K", weight: 20, pay: 1.5, letter: "K" },
  { id: "q", label: "Q", weight: 22, pay: 1.2, letter: "Q" },
];

const INITIAL_GRID: SymbolId[] = [
  "ingot",
  "envelope",
  "jade",
  "flower",
  "tiger",
  "coins",
  "a",
  "k",
  "q",
];

const SYMBOL_BY_ID = new Map(SYMBOLS.map((symbol) => [symbol.id, symbol]));
const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);

function randomSymbol(): SymbolId {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const symbol of SYMBOLS) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol.id;
  }
  return "q";
}

function randomGrid(): SymbolId[] {
  return Array.from({ length: 9 }, randomSymbol);
}

function evaluateGrid(grid: readonly SymbolId[], bet: number) {
  let payout = 0;
  const cells = new Set<number>();
  let lines = 0;

  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const id = grid[a];
    if (id === grid[b] && id === grid[c]) {
      const symbol = SYMBOL_BY_ID.get(id);
      if (!symbol) continue;
      payout += bet * symbol.pay;
      lines += 1;
      cells.add(a);
      cells.add(b);
      cells.add(c);
    }
  }

  return {
    payout: Math.round(payout),
    cells,
    lines,
  };
}

function letterClass(id: LetterSymbolId) {
  switch (id) {
    case "a":
      return "from-fuchsia-200 via-purple-500 to-violet-950";
    case "k":
      return "from-emerald-200 via-green-500 to-emerald-950";
    case "q":
      return "from-cyan-200 via-blue-500 to-blue-950";
  }
}

function ReelCell({
  id,
  spinning,
  won,
  reel,
}: {
  id: SymbolId;
  spinning: boolean;
  won: boolean;
  reel: number;
}) {
  const symbol = SYMBOL_BY_ID.get(id);
  if (!symbol) return null;

  return (
    <div
      className={cn(
        "relative flex aspect-square min-w-0 items-center justify-center overflow-hidden border border-[#ffcf4a]/70 bg-[#650b08] shadow-[inset_0_0_22px_rgba(0,0,0,.68)]",
        spinning && "motion-safe:animate-[tiger-reel-spin_210ms_linear_infinite]",
        won && !spinning && "z-10 motion-safe:animate-[tiger-win-cell_850ms_ease-in-out_infinite]",
      )}
      style={{ animationDelay: `${reel * 24}ms` }}
      title={symbol.label}
    >
      <span className="pointer-events-none absolute left-1 top-0 text-[11px] text-yellow-300/90">
        ❧
      </span>
      <span className="pointer-events-none absolute right-1 top-0 rotate-90 text-[11px] text-yellow-300/90">
        ❧
      </span>
      <span className="pointer-events-none absolute bottom-0 left-1 -rotate-90 text-[11px] text-yellow-300/90">
        ❧
      </span>
      <span className="pointer-events-none absolute bottom-0 right-1 rotate-180 text-[11px] text-yellow-300/90">
        ❧
      </span>

      {symbol.sprite ? (
        <div
          className="size-full bg-no-repeat"
          style={{
            backgroundImage: "url('/golden-tiger/symbols.webp')",
            backgroundSize: "300% 200%",
            backgroundPosition: `${symbol.sprite.x} ${symbol.sprite.y}`,
          }}
          aria-hidden
        />
      ) : (
        <span
          className={cn(
            "bg-gradient-to-b bg-clip-text font-display text-[clamp(2.8rem,14vw,5.2rem)] font-black leading-none text-transparent drop-shadow-[0_4px_0_#5b2100]",
            letterClass(id as LetterSymbolId),
          )}
          style={{ WebkitTextStroke: "1.6px #ffd45e" }}
          aria-hidden
        >
          {symbol.letter}
        </span>
      )}
      <span className="sr-only">{symbol.label}</span>
    </div>
  );
}

export function GoldenTigerGame() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const [bet, setBet] = useState<number>(500);
  const [grid, setGrid] = useState<SymbolId[]>(INITIAL_GRID);
  const [winAmount, setWinAmount] = useState(0);
  const [lastMultiplier, setLastMultiplier] = useState(0);
  const [winningCells, setWinningCells] = useState<Set<number>>(() => new Set());
  const [winningLines, setWinningLines] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const busyRef = useRef(false);
  const stopAutoRef = useRef(false);

  useEffect(() => hydrateFromStorage(), []);

  const performSpin = useCallback(async () => {
    if (busyRef.current) return false;
    const currentBalance = arcadeActions.getBalance();
    if (bet > currentBalance || !arcadeActions.placeBet(bet)) {
      playSound("lose", soundEnabled);
      return false;
    }

    busyRef.current = true;
    setIsSpinning(true);
    setWinningCells(new Set());
    setWinningLines(0);
    setWinAmount(0);
    setLastMultiplier(0);
    playSound("spin", soundEnabled);

    // Fix the complete outcome before the visual reel animation begins.
    const finalGrid = randomGrid();
    const evaluated = evaluateGrid(finalGrid, bet);
    const duration = turbo ? 440 : 980;
    const tickMs = turbo ? 54 : 82;
    const interval = window.setInterval(() => {
      setGrid(randomGrid());
      playSound("tick", soundEnabled);
    }, tickMs);

    await new Promise<void>((resolve) => window.setTimeout(resolve, duration));
    window.clearInterval(interval);
    setGrid(finalGrid);

    if (evaluated.payout > 0) arcadeActions.credit(evaluated.payout);
    const multiplier = evaluated.payout > 0 ? evaluated.payout / bet : 0;
    arcadeActions.recordRound({
      slug: "golden-tiger",
      gameName: "Golden Tiger",
      bet,
      payout: evaluated.payout,
      multiplier,
      note: `${evaluated.lines} linha${evaluated.lines === 1 ? "" : "s"} vencedora${evaluated.lines === 1 ? "" : "s"} · 8 linhas`,
    });

    setWinningCells(evaluated.cells);
    setWinningLines(evaluated.lines);
    setWinAmount(evaluated.payout);
    setLastMultiplier(multiplier);
    setIsSpinning(false);
    busyRef.current = false;

    playSound(
      evaluated.payout >= bet * 10 ? "bigWin" : evaluated.payout > 0 ? "win" : "lose",
      soundEnabled,
    );
    return true;
  }, [bet, soundEnabled, turbo]);

  const startAuto = useCallback(async () => {
    if (busyRef.current || autoLeft > 0) return;
    stopAutoRef.current = false;
    for (let remaining = 10; remaining > 0; remaining -= 1) {
      if (stopAutoRef.current) break;
      setAutoLeft(remaining);
      const played = await performSpin();
      if (!played) break;
      await new Promise<void>((resolve) =>
        window.setTimeout(resolve, turbo ? 240 : 460),
      );
    }
    setAutoLeft(0);
  }, [autoLeft, performSpin, turbo]);

  const betIndex = Math.max(0, BET_STEPS.indexOf(bet as (typeof BET_STEPS)[number]));
  const insufficient = bet > balance;

  function changeBet(direction: -1 | 1) {
    if (isSpinning || autoLeft > 0) return;
    const nextIndex = Math.max(0, Math.min(BET_STEPS.length - 1, betIndex + direction));
    setBet(BET_STEPS[nextIndex]);
  }

  return (
    <div className="min-h-dvh bg-[#080604] px-0 py-0 sm:px-4 sm:py-4">
      <div className="mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-[#3d0604] text-white shadow-[0_0_80px_rgba(0,0,0,.95)] sm:min-h-0 sm:rounded-[28px] sm:border sm:border-yellow-500/35">
        <div className="relative bg-[#2b0303]">
          <img
            src="/golden-tiger/hero.webp"
            alt="Golden Tiger, tigrinho em templo dourado com jackpot fictício"
            className="block w-full select-none"
            draggable={false}
          />

          <div className="absolute left-2 top-2 flex gap-1.5">
            <Button
              asChild
              size="icon"
              variant="ghost"
              className="size-9 rounded-full border border-yellow-300/70 bg-black/55 text-yellow-200 shadow-lg backdrop-blur hover:bg-black/70 hover:text-yellow-100"
            >
              <Link to="/" aria-label="Voltar ao lobby">
                <ArrowLeft className="size-4.5" />
              </Link>
            </Button>
            <button
              type="button"
              onClick={() => arcadeActions.toggleSound()}
              className="flex size-9 items-center justify-center rounded-full border border-yellow-300/70 bg-black/55 text-yellow-200 shadow-lg backdrop-blur"
              aria-label={soundEnabled ? "Desativar som" : "Ativar som"}
            >
              {soundEnabled ? <Volume2 className="size-4.5" /> : <VolumeX className="size-4.5" />}
            </button>
          </div>

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-yellow-300/55 bg-black/55 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-yellow-100 backdrop-blur">
            moedas fictícias · sem valor real
          </div>
        </div>

        <section className="relative border-x-[3px] border-[#d99211] bg-gradient-to-b from-[#8e120b] via-[#660907] to-[#3c0403] p-2 shadow-[inset_0_0_28px_rgba(255,184,47,.12)]">
          <div className="grid grid-cols-3 overflow-hidden border-2 border-[#f1bd38] bg-[#77100b] shadow-[0_0_28px_rgba(255,178,42,.24)]">
            {grid.map((id, index) => (
              <ReelCell
                key={`${index}-${id}`}
                id={id}
                spinning={isSpinning}
                won={winningCells.has(index)}
                reel={index % 3}
              />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-[46px_minmax(0,1fr)_46px] items-center gap-2 border-x-[3px] border-[#d99211] bg-[#610807] px-2 py-2">
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-full border-2 border-[#f6bf35] bg-gradient-to-b from-[#d52b20] to-[#740707] text-yellow-200 shadow-[0_5px_14px_rgba(0,0,0,.45)]"
            aria-label="Informações do jogo"
            title="8 linhas: 3 horizontais, 3 verticais e 2 diagonais"
          >
            <Info className="size-5" />
          </button>

          <div
            className={cn(
              "rounded-[22px] border-2 border-[#f0b932] bg-gradient-to-b from-[#0c7a43] to-[#034326] px-3 py-2 text-center shadow-[inset_0_2px_9px_rgba(255,255,255,.12),0_6px_16px_rgba(0,0,0,.4)]",
              winAmount > 0 && !isSpinning && "motion-safe:animate-[tiger-win-banner_900ms_ease-in-out_infinite]",
            )}
            role="status"
            aria-live="polite"
          >
            <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-yellow-200">
              Win
            </p>
            <p className="font-display text-[clamp(1.5rem,8vw,2.25rem)] font-black leading-none tabular-nums text-yellow-300 drop-shadow-[0_2px_0_#6c3600]">
              {formatCoins(winAmount)}
            </p>
            <p className="mt-1 text-[9px] font-bold text-yellow-100/75">
              {winningLines > 0
                ? `${winningLines} linha${winningLines === 1 ? "" : "s"} · ${formatMultiplier(lastMultiplier)}`
                : "8 linhas premiadas"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setTurbo((value) => !value)}
            className={cn(
              "flex size-11 items-center justify-center rounded-full border-2 border-[#f6bf35] shadow-[0_5px_14px_rgba(0,0,0,.45)]",
              turbo
                ? "bg-gradient-to-b from-yellow-300 to-orange-600 text-[#351100]"
                : "bg-gradient-to-b from-[#d52b20] to-[#740707] text-yellow-200",
            )}
            aria-label="Modo turbo"
            aria-pressed={turbo}
          >
            <Bolt className="size-5" />
          </button>
        </section>

        <section className="border-x-[3px] border-b-[3px] border-[#d99211] bg-gradient-to-b from-[#8e140d] via-[#650907] to-[#390403] px-2 pb-4 pt-2">
          <div className="grid grid-cols-[minmax(0,1fr)_122px_minmax(0,1fr)] items-end gap-2">
            <div className="space-y-2">
              <div className="rounded-xl border border-yellow-500/80 bg-black/55 px-2 py-2 text-center shadow-inner">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-yellow-200">
                  Balance
                </p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-white">
                  {formatCoins(balance)}
                </p>
              </div>

              {autoLeft > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    stopAutoRef.current = true;
                  }}
                  className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-yellow-500 bg-gradient-to-b from-emerald-700 to-emerald-950 px-2 font-display text-[10px] font-black uppercase text-yellow-200 shadow-lg"
                >
                  <RotateCw className="size-4 animate-spin" /> Parar {autoLeft}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void startAuto()}
                  disabled={isSpinning || insufficient}
                  className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-yellow-500 bg-gradient-to-b from-[#c82419] to-[#720706] px-2 font-display text-[10px] font-black uppercase text-yellow-200 shadow-lg disabled:opacity-50"
                >
                  <RotateCw className="size-4" /> Auto Play
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => void performSpin()}
              disabled={isSpinning || autoLeft > 0 || insufficient}
              className={cn(
                "relative flex aspect-square w-[122px] items-center justify-center rounded-full border-[7px] border-[#f2bb30] bg-[radial-gradient(circle_at_50%_32%,#67e260,#0a9d36_50%,#03561c)] text-yellow-200 shadow-[inset_0_5px_13px_rgba(255,255,255,.34),0_9px_24px_rgba(0,0,0,.58)] disabled:opacity-55",
                isSpinning
                  ? "motion-safe:animate-[tiger-spin-button_500ms_linear_infinite]"
                  : "motion-safe:animate-[tiger-spin-pulse_1.8s_ease-in-out_infinite]",
              )}
              aria-label="Girar Golden Tiger"
            >
              <RotateCw className="size-16 stroke-[2.6] drop-shadow-[0_3px_0_#604000]" />
            </button>

            <div className="space-y-2">
              <div className="rounded-xl border border-yellow-500/80 bg-black/55 px-2 py-2 text-center shadow-inner">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-yellow-200">
                  Total Bet
                </p>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => changeBet(-1)}
                    disabled={isSpinning || autoLeft > 0}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full border border-yellow-500 bg-red-950 text-yellow-200 disabled:opacity-45"
                    aria-label="Diminuir aposta"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="min-w-0 text-xs font-bold tabular-nums text-white">
                    {formatCoins(bet)}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeBet(1)}
                    disabled={isSpinning || autoLeft > 0}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full border border-yellow-500 bg-red-950 text-yellow-200 disabled:opacity-45"
                    aria-label="Aumentar aposta"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setBet(BET_STEPS[BET_STEPS.length - 1])}
                disabled={isSpinning || autoLeft > 0}
                className="min-h-12 w-full rounded-xl border-2 border-yellow-500 bg-gradient-to-b from-[#c82419] to-[#720706] px-2 font-display text-[10px] font-black uppercase text-yellow-200 shadow-lg disabled:opacity-45"
              >
                Max Bet
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-yellow-500/35 bg-black/30 px-3 py-2 text-[9px] font-semibold text-yellow-100/75">
            <span className="flex items-center gap-1">
              <Sparkles className="size-3.5 text-yellow-300" />
              3 horizontais · 3 verticais · 2 diagonais
            </span>
            <span className={cn("rounded-full px-2 py-0.5 font-black", turbo ? "bg-yellow-400 text-black" : "bg-white/5")}>
              TURBO {turbo ? "ON" : "OFF"}
            </span>
          </div>

          {insufficient && (
            <p className="mt-2 rounded-xl border border-red-400/45 bg-red-950/80 px-3 py-2 text-center text-xs font-semibold text-red-100" role="alert">
              Saldo fictício insuficiente. Volte ao lobby para recarregar moedas grátis.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
