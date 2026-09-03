import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bolt, Info, Minus, Plus, RotateCw, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import heroArt from "@/assets/golden-tiger/hero.webp";
import symbolsArt from "@/assets/golden-tiger/symbols.webp";
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
const INITIAL: SymbolId[] = ["ingot", "envelope", "jade", "flower", "tiger", "coins", "a", "k", "q"];

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
    if (!first || first !== second || second !== third) continue;
    const def = BY_ID.get(first);
    if (!def) continue;
    payout += bet * def.pay;
    lines += 1;
    winning.add(a);
    winning.add(b);
    winning.add(c);
  }

  return { payout: Math.round(payout), lines, winning };
}

function Letter({ id }: { id: LetterId }) {
  const letter = id.toUpperCase();
  const gradient =
    id === "a"
      ? "from-fuchsia-300 via-purple-500 to-violet-950"
      : id === "k"
        ? "from-emerald-300 via-green-500 to-emerald-950"
        : "from-cyan-200 via-blue-500 to-blue-950";

  return (
    <span
      className={cn(
        "bg-gradient-to-b bg-clip-text font-serif text-[clamp(3rem,15vw,5.5rem)] font-black leading-none text-transparent drop-shadow-[0_5px_0_#6a2700]",
        gradient,
      )}
      style={{ WebkitTextStroke: "2px #ffd65d" }}
    >
      {letter}
    </span>
  );
}

function Cell({ id, spinning, winning, column }: { id: SymbolId; spinning: boolean; winning: boolean; column: number }) {
  const symbol = BY_ID.get(id);
  if (!symbol) return null;

  return (
    <div
      className={cn(
        "relative flex aspect-[1.03] items-center justify-center overflow-hidden border border-[#efb62e] bg-[#720d08] shadow-[inset_0_0_26px_rgba(25,0,0,.7)]",
        spinning && "motion-safe:animate-[tiger-reel-spin_210ms_linear_infinite]",
        winning && !spinning && "z-10 motion-safe:animate-[tiger-win-cell_850ms_ease-in-out_infinite]",
      )}
      style={{ animationDelay: `${column * 28}ms` }}
      title={symbol.label}
    >
      <span className="absolute left-1 top-0 z-20 text-[11px] text-yellow-300">❧</span>
      <span className="absolute right-1 top-0 z-20 rotate-90 text-[11px] text-yellow-300">❧</span>
      <span className="absolute bottom-0 left-1 z-20 -rotate-90 text-[11px] text-yellow-300">❧</span>
      <span className="absolute bottom-0 right-1 z-20 rotate-180 text-[11px] text-yellow-300">❧</span>

      {symbol.sprite ? (
        <div
          className="absolute inset-0 bg-no-repeat"
          style={{
            backgroundImage: `url(${symbolsArt})`,
            backgroundSize: "300% 200%",
            backgroundPosition: `${symbol.sprite.x} ${symbol.sprite.y}`,
          }}
          aria-hidden="true"
        />
      ) : (
        <Letter id={id as LetterId} />
      )}
    </div>
  );
}

export function GoldenTigerVisual() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const [bet, setBet] = useState<number>(500);
  const [grid, setGrid] = useState<SymbolId[]>(INITIAL);
  const [win, setWin] = useState(0);
  const [multiplier, setMultiplier] = useState(0);
  const [winLines, setWinLines] = useState(0);
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [spinning, setSpinning] = useState(false);
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
    setSpinning(true);
    setWin(0);
    setMultiplier(0);
    setWinLines(0);
    setWinning(new Set());
    playSound("spin", soundEnabled);

    const finalGrid = makeGrid();
    const result = evaluate(finalGrid, bet);
    const duration = turbo ? 430 : 960;
    const tick = window.setInterval(() => {
      setGrid(makeGrid());
      playSound("tick", soundEnabled);
    }, turbo ? 55 : 84);

    await new Promise<void>((resolve) => window.setTimeout(resolve, duration));
    window.clearInterval(tick);
    setGrid(finalGrid);

    if (result.payout > 0) arcadeActions.credit(result.payout);
    const roundMultiplier = result.payout > 0 ? result.payout / bet : 0;
    arcadeActions.recordRound({
      slug: "golden-tiger",
      gameName: "Golden Tiger",
      bet,
      payout: result.payout,
      multiplier: roundMultiplier,
      note: `${result.lines} linha${result.lines === 1 ? "" : "s"} vencedora${result.lines === 1 ? "" : "s"}`,
    });

    setWin(result.payout);
    setMultiplier(roundMultiplier);
    setWinLines(result.lines);
    setWinning(result.winning);
    setSpinning(false);
    busyRef.current = false;
    playSound(result.payout >= bet * 10 ? "bigWin" : result.payout > 0 ? "win" : "lose", soundEnabled);
    return true;
  }, [bet, soundEnabled, turbo]);

  const autoPlay = useCallback(async () => {
    if (busyRef.current || autoLeft > 0) return;
    stopRef.current = false;
    for (let remaining = 10; remaining > 0; remaining -= 1) {
      if (stopRef.current) break;
      setAutoLeft(remaining);
      if (!(await spin())) break;
      await new Promise<void>((resolve) => window.setTimeout(resolve, turbo ? 220 : 430));
    }
    setAutoLeft(0);
  }, [autoLeft, spin, turbo]);

  const index = BET_STEPS.findIndex((value) => value === bet);
  const insufficient = bet > balance;

  const adjustBet = (direction: -1 | 1) => {
    if (spinning || autoLeft > 0) return;
    const safe = index < 0 ? 0 : index;
    const next = BET_STEPS[Math.max(0, Math.min(BET_STEPS.length - 1, safe + direction))];
    if (next !== undefined) setBet(next);
  };

  return (
    <main className="min-h-dvh bg-[#070403] p-0 sm:p-4">
      <section className="mx-auto w-full max-w-[430px] overflow-hidden bg-[#4a0504] text-white shadow-[0_0_90px_rgba(0,0,0,.96)] sm:rounded-[26px] sm:border sm:border-[#d99b19]/50">
        <header className="relative overflow-hidden bg-[#350302]">
          <img src={heroArt} alt="Golden Tiger em templo dourado com jackpot fictício" className="block w-full" draggable={false} />
          <div className="absolute left-2 top-2 flex gap-2">
            <Link to="/" aria-label="Voltar ao lobby" className="flex size-9 items-center justify-center rounded-full border-2 border-[#efb82d] bg-[#3b0704]/90 text-yellow-200 shadow-lg backdrop-blur-sm">
              <ArrowLeft className="size-4" />
            </Link>
            <button type="button" onClick={() => arcadeActions.toggleSound()} aria-label={soundEnabled ? "Desativar som" : "Ativar som"} className="flex size-9 items-center justify-center rounded-full border-2 border-[#efb82d] bg-[#3b0704]/90 text-yellow-200 shadow-lg backdrop-blur-sm">
              {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </button>
          </div>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-yellow-300/60 bg-black/70 px-3 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-yellow-100">
            moedas fictícias · sem valor real
          </div>
        </header>

        <div className="relative border-x-[5px] border-[#d99712] bg-gradient-to-b from-[#8e110a] via-[#690906] to-[#3a0302] px-2 py-2 shadow-[inset_0_0_36px_rgba(255,181,44,.12)]">
          <div className="grid grid-cols-3 overflow-hidden border-[3px] border-[#f4be38] bg-[#6f0b08] shadow-[0_0_30px_rgba(255,178,33,.24)]">
            {grid.map((id, cellIndex) => (
              <Cell key={`${cellIndex}-${id}`} id={id} spinning={spinning} winning={winning.has(cellIndex)} column={cellIndex % 3} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-2 border-x-[5px] border-[#d99712] bg-[#720b07] px-2 py-2">
          <button type="button" title="8 linhas: 3 horizontais, 3 verticais e 2 diagonais" aria-label="Informações" className="flex size-11 items-center justify-center rounded-full border-2 border-[#f0b82f] bg-gradient-to-b from-[#d72b1e] to-[#750704] text-yellow-200 shadow-lg">
            <Info className="size-5" />
          </button>
          <div className={cn("rounded-[22px] border-[3px] border-[#eeb332] bg-gradient-to-b from-[#137e49] to-[#064428] px-2 py-2 text-center shadow-[0_8px_18px_rgba(0,0,0,.42)]", win > 0 && !spinning && "motion-safe:animate-[tiger-win-banner_900ms_ease-in-out_infinite]")} role="status" aria-live="polite">
            <div className="font-serif text-[10px] font-black uppercase tracking-[0.2em] text-yellow-200">Win</div>
            <div className="font-serif text-[clamp(1.55rem,8vw,2.4rem)] font-black leading-none tabular-nums text-yellow-300 drop-shadow-[0_3px_0_#673000]">{formatCoins(win)}</div>
            <div className="mt-1 text-[9px] font-semibold text-yellow-100/80">{winLines ? `${winLines} linha${winLines === 1 ? "" : "s"} · ${formatMultiplier(multiplier)}` : "boa sorte"}</div>
          </div>
          <button type="button" onClick={() => setTurbo((value) => !value)} aria-label="Modo turbo" aria-pressed={turbo} className={cn("flex size-11 items-center justify-center rounded-full border-2 border-[#f0b82f] shadow-lg", turbo ? "bg-gradient-to-b from-yellow-300 to-orange-600 text-[#351100]" : "bg-gradient-to-b from-[#d72b1e] to-[#750704] text-yellow-200")}>
            <Bolt className="size-5" />
          </button>
        </div>

        <div className="border-x-[5px] border-b-[5px] border-[#d99712] bg-gradient-to-b from-[#8e130c] via-[#650807] to-[#390302] px-2 pb-4 pt-2">
          <div className="grid grid-cols-[1fr_126px_1fr] items-end gap-2">
            <div className="space-y-2">
              <div className="rounded-xl border-2 border-[#c98816] bg-[#1d0906] px-2 py-2 text-center shadow-inner">
                <div className="text-[9px] font-black uppercase tracking-[0.13em] text-yellow-200">Balance</div>
                <div className="mt-0.5 text-sm font-bold tabular-nums">{formatCoins(balance)}</div>
              </div>
              {autoLeft > 0 ? (
                <button type="button" onClick={() => { stopRef.current = true; }} className="flex min-h-12 w-full items-center justify-center gap-1 rounded-xl border-2 border-[#eeb432] bg-gradient-to-b from-[#087743] to-[#043f25] font-serif text-[10px] font-black uppercase text-yellow-200">
                  <RotateCw className="size-4 animate-spin" /> Parar {autoLeft}
                </button>
              ) : (
                <button type="button" onClick={() => void autoPlay()} disabled={spinning || insufficient} className="flex min-h-12 w-full items-center justify-center gap-1 rounded-xl border-2 border-[#eeb432] bg-gradient-to-b from-[#cb261a] to-[#730604] font-serif text-[10px] font-black uppercase text-yellow-200 disabled:opacity-45">
                  <RotateCw className="size-4" /> Auto Play
                </button>
              )}
            </div>

            <button type="button" onClick={() => void spin()} disabled={spinning || autoLeft > 0 || insufficient} aria-label="Girar Golden Tiger" className={cn("relative flex aspect-square w-[126px] items-center justify-center rounded-full border-[8px] border-[#efba32] bg-[radial-gradient(circle_at_50%_28%,#70e66a,#12a43e_50%,#04551d)] text-yellow-200 shadow-[inset_0_6px_15px_rgba(255,255,255,.34),0_9px_25px_rgba(0,0,0,.58),0_0_25px_rgba(49,221,89,.2)] disabled:opacity-55", spinning ? "motion-safe:animate-[tiger-spin-button_500ms_linear_infinite]" : "motion-safe:animate-[tiger-spin-pulse_1.8s_ease-in-out_infinite]")}>
              <RotateCw className="size-16 stroke-[2.8] drop-shadow-[0_4px_0_#5d3a00]" />
            </button>

            <div className="space-y-2">
              <div className="rounded-xl border-2 border-[#c98816] bg-[#1d0906] px-1.5 py-2 text-center shadow-inner">
                <div className="text-[9px] font-black uppercase tracking-[0.13em] text-yellow-200">Total Bet</div>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <button type="button" onClick={() => adjustBet(-1)} disabled={spinning || autoLeft > 0} aria-label="Diminuir aposta" className="flex size-7 items-center justify-center rounded-full border border-[#d99a18] bg-[#700704] text-yellow-200 disabled:opacity-40"><Minus className="size-4" /></button>
                  <span className="text-xs font-bold tabular-nums">{formatCoins(bet)}</span>
                  <button type="button" onClick={() => adjustBet(1)} disabled={spinning || autoLeft > 0} aria-label="Aumentar aposta" className="flex size-7 items-center justify-center rounded-full border border-[#d99a18] bg-[#700704] text-yellow-200 disabled:opacity-40"><Plus className="size-4" /></button>
                </div>
              </div>
              <button type="button" onClick={() => setBet(10_000)} disabled={spinning || autoLeft > 0} className="min-h-12 w-full rounded-xl border-2 border-[#eeb432] bg-gradient-to-b from-[#cb261a] to-[#730604] font-serif text-[10px] font-black uppercase text-yellow-200 disabled:opacity-45">Max Bet</button>
            </div>
          </div>

          {insufficient ? <div className="mt-2 rounded-lg border border-red-400/50 bg-red-950/80 px-3 py-2 text-center text-xs font-semibold text-red-100">Saldo fictício insuficiente. Recarregue moedas no lobby.</div> : null}
        </div>
      </section>
    </main>
  );
}
