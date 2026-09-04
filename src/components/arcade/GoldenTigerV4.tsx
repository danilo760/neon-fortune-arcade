import { Link } from "@tanstack/react-router";
import { ArrowLeft, Coins, Menu, Music2, RotateCw, Volume2, VolumeX, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GoldenTigerSymbol, type GoldenTigerSymbolId } from "@/components/arcade/GoldenTigerSymbols";
import { formatCoins } from "@/lib/arcade/format";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

const BET_STEPS = [10, 50, 100, 200, 500, 1_000, 5_000, 10_000] as const;

const PAYLINES = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [0, 6, 12, 8, 4],
  [10, 6, 2, 8, 14],
  [0, 6, 7, 8, 4],
  [10, 6, 7, 8, 14],
  [5, 1, 2, 3, 9],
  [5, 11, 12, 13, 9],
  [0, 1, 7, 13, 14],
] as const;

const PAYLINE_LABELS = [4, 2, 6, 8, 1, 9, 7, 3, 5, 10] as const;

const PARTICLES = Array.from({ length: 28 }, (_, index) => ({
  left: 4 + ((index * 19) % 91),
  delay: (index % 8) * 45,
  drift: -72 + ((index * 37) % 145),
}));

const FLOATING_COINS = Array.from({ length: 14 }, (_, index) => ({
  left: 4 + ((index * 23) % 92),
  delay: (index % 7) * 420,
  duration: 2400 + (index % 5) * 380,
  drift: -35 + ((index * 41) % 70),
}));

type SymbolDef = {
  id: GoldenTigerSymbolId;
  label: string;
  weight: number;
  pay3: number;
  pay4: number;
  pay5: number;
};

type SpinResult = {
  payout: number;
  winning: Set<number>;
  lines: number;
  scatterIndexes: Set<number>;
  scatterCount: number;
  bonusAward: number;
};

const SYMBOLS: readonly SymbolDef[] = [
  { id: "wild", label: "Tiger Wild", weight: 6, pay3: 4.5, pay4: 8, pay5: 14 },
  { id: "scatter", label: "Cartinha da Fortuna", weight: 8, pay3: 0, pay4: 0, pay5: 0 },
  { id: "lion", label: "Leão da Sorte", weight: 9, pay3: 3.2, pay4: 5.5, pay5: 10 },
  { id: "ingot", label: "Lingote Dourado", weight: 11, pay3: 2.7, pay4: 4.5, pay5: 8 },
  { id: "fortuneBag", label: "Bolsa da Fortuna", weight: 13, pay3: 2.2, pay4: 3.7, pay5: 6.4 },
  { id: "firecracker", label: "Fogos da Sorte", weight: 14, pay3: 1.9, pay4: 3.1, pay5: 5.2 },
  { id: "jadeKnot", label: "Nó de Jade", weight: 16, pay3: 1.6, pay4: 2.6, pay5: 4.3 },
  { id: "lantern", label: "Lanterna Imperial", weight: 18, pay3: 1.35, pay4: 2.2, pay5: 3.6 },
  { id: "orange", label: "Laranja da Sorte", weight: 20, pay3: 1.15, pay4: 1.8, pay5: 3 },
];

const SYMBOL_BY_ID = new Map<GoldenTigerSymbolId, SymbolDef>(SYMBOLS.map((symbol) => [symbol.id, symbol]));
const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
const INITIAL_GRID: GoldenTigerSymbolId[] = [
  "ingot", "scatter", "orange", "fortuneBag", "firecracker",
  "firecracker", "wild", "ingot", "scatter", "lion",
  "jadeKnot", "fortuneBag", "scatter", "lantern", "orange",
];

const REEL_STREAMS: readonly GoldenTigerSymbolId[][] = [
  ["ingot", "orange", "fortuneBag", "wild", "firecracker", "scatter"],
  ["lion", "scatter", "jadeKnot", "ingot", "orange", "lantern"],
  ["fortuneBag", "firecracker", "wild", "orange", "scatter", "jadeKnot"],
  ["lantern", "ingot", "lion", "scatter", "fortuneBag", "orange"],
  ["orange", "jadeKnot", "firecracker", "wild", "ingot", "scatter"],
];

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function pickSymbol(): GoldenTigerSymbolId {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const symbol of SYMBOLS) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol.id;
  }
  return "orange";
}

function makeGrid() {
  return Array.from({ length: 15 }, pickSymbol);
}

function bonusForScatters(count: number) {
  if (count >= 5) return 20;
  if (count === 4) return 12;
  if (count === 3) return 8;
  return 0;
}

function evaluateLine(grid: readonly GoldenTigerSymbolId[], line: readonly number[], bet: number) {
  const ids = line.map((index) => grid[index]).filter((id): id is GoldenTigerSymbolId => Boolean(id));
  if (ids.length !== 5) return { payout: 0, indexes: [] as number[] };

  const target = ids.find((id) => id !== "wild" && id !== "scatter") ?? "wild";

  let count = 0;
  for (const id of ids) {
    if (id === "scatter") break;
    if (id === target || id === "wild") count += 1;
    else break;
  }
  if (count < 3) return { payout: 0, indexes: [] as number[] };

  const def = SYMBOL_BY_ID.get(target);
  if (!def) return { payout: 0, indexes: [] as number[] };
  const multiplier = count === 5 ? def.pay5 : count === 4 ? def.pay4 : def.pay3;
  return { payout: Math.round(bet * multiplier), indexes: line.slice(0, count) };
}

function evaluate(grid: readonly GoldenTigerSymbolId[], bet: number): SpinResult {
  let payout = 0;
  let lines = 0;
  const winning = new Set<number>();
  const scatterIndexes = new Set<number>();

  grid.forEach((id, index) => {
    if (id === "scatter") scatterIndexes.add(index);
  });

  for (const line of PAYLINES) {
    const result = evaluateLine(grid, line, bet);
    if (result.payout <= 0) continue;
    payout += result.payout;
    lines += 1;
    result.indexes.forEach((index) => winning.add(index));
  }

  const scatterCount = scatterIndexes.size;
  return {
    payout,
    winning,
    lines,
    scatterIndexes,
    scatterCount,
    bonusAward: bonusForScatters(scatterCount),
  };
}

function ReelWindow({
  id,
  column,
  row,
  spinning,
  slow,
  landed,
  winning,
  scatter,
}: {
  id: GoldenTigerSymbolId;
  column: number;
  row: number;
  spinning: boolean;
  slow: boolean;
  landed: boolean;
  winning: boolean;
  scatter: boolean;
}) {
  const stream = REEL_STREAMS[column] ?? REEL_STREAMS[0]!;

  if (spinning) {
    const offset = row % stream.length;
    const items = Array.from({ length: 5 }, (_, index) => stream[(index + offset) % stream.length] ?? "orange");
    return (
      <div className="absolute inset-0 overflow-hidden bg-[#36020a]">
        <div className={cn("absolute inset-x-[4%] -top-[250%] h-[350%] gt4-reel-running", slow && "gt4-reel-slow") }>
          {items.map((symbol, index) => (
            <div key={`${symbol}-${index}`} className="flex h-1/5 items-center justify-center p-[5%]">
              <GoldenTigerSymbol id={symbol} />
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(27,0,7,.82),transparent_26%,transparent_73%,rgba(27,0,7,.84))]" />
      </div>
    );
  }

  return (
    <div className={cn("absolute inset-0 p-[5%]", landed && "gt4-cell-land", winning && "gt4-winning", scatter && "gt4-scatter")} style={landed ? { animationDelay: `${row * 48}ms` } : undefined}>
      <GoldenTigerSymbol id={id} />
    </div>
  );
}

export function GoldenTigerV4() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);

  const [bet, setBet] = useState<number>(200);
  const [grid, setGrid] = useState<GoldenTigerSymbolId[]>(INITIAL_GRID);
  const [win, setWin] = useState(0);
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [scatterIndexes, setScatterIndexes] = useState<Set<number>>(() => new Set());
  const [spinning, setSpinning] = useState(false);
  const [stoppedColumns, setStoppedColumns] = useState(5);
  const [landingColumn, setLandingColumn] = useState(-1);
  const [anticipationScatters, setAnticipationScatters] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [showWinFx, setShowWinFx] = useState(false);
  const [bonusActive, setBonusActive] = useState(false);
  const [bonusSpinsLeft, setBonusSpinsLeft] = useState(0);
  const [bonusWin, setBonusWin] = useState(0);
  const [bonusIntro, setBonusIntro] = useState<number | null>(null);
  const [bonusSummary, setBonusSummary] = useState<number | null>(null);

  const busyRef = useRef(false);
  const stopAutoRef = useRef(false);
  const bonusRef = useRef(false);

  useEffect(() => hydrateFromStorage(), []);

  const betIndex = BET_STEPS.findIndex((value) => value === bet);
  const insufficient = bet > balance;
  const bigWin = win >= bet * 10 && !spinning;

  const stoppedScatterCount = useMemo(() => {
    if (!spinning) return scatterIndexes.size;
    let count = 0;
    grid.forEach((id, index) => {
      if (index % 5 < stoppedColumns && id === "scatter") count += 1;
    });
    return count;
  }, [grid, scatterIndexes, spinning, stoppedColumns]);

  const changeBet = (direction: -1 | 1) => {
    if (spinning || bonusActive || autoLeft > 0) return;
    const current = betIndex < 0 ? 0 : betIndex;
    const next = Math.max(0, Math.min(BET_STEPS.length - 1, current + direction));
    const nextBet = BET_STEPS[next];
    if (nextBet !== undefined) setBet(nextBet);
  };

  const setMaxBet = () => {
    if (spinning || bonusActive || autoLeft > 0) return;
    const affordable = [...BET_STEPS].reverse().find((value) => value <= balance);
    if (affordable !== undefined) setBet(affordable);
  };

  const spinRound = useCallback(async (freeSpin: boolean): Promise<SpinResult | null> => {
    if (busyRef.current) return null;
    if (!freeSpin && !arcadeActions.placeBet(bet)) {
      playSound("lose", soundEnabled);
      return null;
    }

    busyRef.current = true;
    setSpinning(true);
    setStoppedColumns(0);
    setLandingColumn(-1);
    setAnticipationScatters(0);
    setWin(0);
    setWinning(new Set());
    setScatterIndexes(new Set());
    setShowWinFx(false);
    playSound("spin", soundEnabled);

    const finalGrid = makeGrid();
    const result = evaluate(finalGrid, bet);
    let scattersSeen = 0;

    await wait(turbo ? 180 : 560);

    for (let column = 0; column < 5; column += 1) {
      setLandingColumn(column);
      setStoppedColumns(column + 1);
      setGrid((current) => current.map((id, index) => (index % 5 <= column ? (finalGrid[index] ?? id) : id)));
      playSound("tick", soundEnabled);

      const columnScatters = [0, 1, 2].reduce((sum, row) => sum + (finalGrid[row * 5 + column] === "scatter" ? 1 : 0), 0);
      scattersSeen += columnScatters;

      if (column < 4 && scattersSeen > 0) {
        setAnticipationScatters(scattersSeen);
        playSound("anticipation", soundEnabled);
        await wait(turbo ? (scattersSeen >= 2 ? 340 : 210) : (scattersSeen >= 2 ? 980 : 560));
      } else {
        await wait(turbo ? 72 : 150);
      }
    }

    setGrid(finalGrid);
    setLandingColumn(-1);
    setAnticipationScatters(0);
    setScatterIndexes(result.scatterIndexes);
    setWinning(result.winning);
    setWin(result.payout);
    setSpinning(false);
    setStoppedColumns(5);
    busyRef.current = false;

    if (result.payout > 0) {
      arcadeActions.credit(result.payout);
      setShowWinFx(true);
      window.setTimeout(() => setShowWinFx(false), result.payout >= bet * 10 ? 1800 : 1100);
    }

    arcadeActions.recordRound({
      slug: "golden-tiger",
      gameName: "Golden Tiger",
      bet: freeSpin ? 0 : bet,
      payout: result.payout,
      multiplier: result.payout > 0 ? result.payout / bet : 0,
      note: `${freeSpin ? "FREE SPIN · " : ""}${result.lines} linha${result.lines === 1 ? "" : "s"} · ${result.scatterCount} cartinha${result.scatterCount === 1 ? "" : "s"}`,
    });

    playSound(result.payout >= bet * 10 ? "bigWin" : result.payout > 0 ? "win" : "lose", soundEnabled);
    return result;
  }, [bet, soundEnabled, turbo]);

  const runBonus = useCallback(async (initialAward: number) => {
    if (initialAward <= 0 || bonusRef.current) return;
    bonusRef.current = true;
    setBonusActive(true);
    setBonusWin(0);
    setBonusSpinsLeft(initialAward);
    setBonusIntro(initialAward);
    playSound("bonus", soundEnabled);
    await wait(turbo ? 650 : 1200);
    setBonusIntro(null);

    let remaining = initialAward;
    let total = 0;
    while (remaining > 0) {
      setBonusSpinsLeft(remaining);
      await wait(turbo ? 120 : 280);
      const result = await spinRound(true);
      if (!result) break;
      total += result.payout;
      setBonusWin(total);
      remaining -= 1;
      if (result.bonusAward > 0) {
        remaining += result.bonusAward;
        setBonusSpinsLeft(remaining);
        playSound("bonus", soundEnabled);
        await wait(turbo ? 450 : 850);
      }
    }

    setBonusSummary(total);
    playSound("cash", soundEnabled);
    await wait(turbo ? 800 : 1500);
    setBonusSummary(null);
    setBonusSpinsLeft(0);
    setBonusActive(false);
    bonusRef.current = false;
  }, [soundEnabled, spinRound, turbo]);

  const spin = useCallback(async () => {
    if (busyRef.current || bonusRef.current) return false;
    const result = await spinRound(false);
    if (!result) return false;
    if (result.bonusAward > 0) await runBonus(result.bonusAward);
    return true;
  }, [runBonus, spinRound]);

  const startAuto = useCallback(async () => {
    if (busyRef.current || bonusRef.current || autoLeft > 0) return;
    stopAutoRef.current = false;
    for (let remaining = 10; remaining > 0; remaining -= 1) {
      if (stopAutoRef.current) break;
      setAutoLeft(remaining);
      const played = await spin();
      if (!played) break;
      await wait(turbo ? 150 : 330);
    }
    setAutoLeft(0);
  }, [autoLeft, spin, turbo]);

  const anticipationText = anticipationScatters >= 2
    ? "2 CARTINHAS... FALTA SÓ 1!"
    : anticipationScatters === 1
      ? "1 CARTINHA... AS OUTRAS FICAM MAIS TENSAS!"
      : null;

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#070102] text-white sm:px-3 sm:py-2">
      <section className="relative mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-[linear-gradient(180deg,#491008_0%,#260006_42%,#160004_100%)] shadow-[0_0_90px_rgba(0,0,0,.96)] sm:min-h-0 sm:rounded-[28px] sm:border sm:border-yellow-500/30">
        <div className="relative h-[255px] overflow-hidden bg-[radial-gradient(circle_at_50%_28%,#ffb63e_0%,#bd2a16_35%,#651014_66%,#2a0208_100%)]">
          <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_12%_20%,#ff9acb_0_3px,transparent_4px),radial-gradient(circle_at_82%_16%,#ff83bb_0_4px,transparent_5px),radial-gradient(circle_at_68%_35%,#ffb6db_0_3px,transparent_4px)] [background-size:74px_74px,92px_92px,110px_110px]" />
          <div className="absolute bottom-0 left-1/2 h-24 w-[115%] -translate-x-1/2 bg-[linear-gradient(180deg,transparent,#2c0208)] opacity-70 [clip-path:polygon(0_100%,0_82%,8%_82%,12%_62%,20%_62%,24%_72%,31%_72%,36%_46%,43%_46%,47%_57%,54%_57%,60%_38%,66%_38%,71%_58%,78%_58%,83%_70%,90%_70%,94%_83%,100%_83%,100%_100%)]" />

          {FLOATING_COINS.map((coin, index) => (
            <span
              key={index}
              className="pointer-events-none absolute top-[-18px] z-10 size-4 rounded-full border-2 border-yellow-200 bg-[radial-gradient(circle_at_35%_30%,#fff3a6,#f9b51d_48%,#9a4300)] shadow-[0_0_10px_rgba(255,205,55,.8)] motion-safe:animate-[gt4-coin-float_var(--coin-duration)_linear_infinite]"
              style={{ left: `${coin.left}%`, animationDelay: `${coin.delay}ms`, ["--coin-duration" as string]: `${coin.duration}ms`, ["--drift" as string]: `${coin.drift}px` }}
            />
          ))}

          <div className="absolute left-3 top-3 z-40 flex gap-2">
            <Link to="/" aria-label="Voltar ao lobby" className="flex size-10 items-center justify-center rounded-full border-2 border-yellow-400 bg-[#7e0709]/90 text-yellow-100 shadow-[0_0_14px_rgba(255,173,42,.42)]"><ArrowLeft className="size-5" /></Link>
            <button type="button" aria-label="Menu" className="flex size-10 items-center justify-center rounded-full border-2 border-yellow-400 bg-[#7e0709]/90 text-yellow-100"><Menu className="size-5" /></button>
          </div>

          <div className="absolute right-3 top-3 z-40 flex gap-2">
            <button type="button" onClick={() => arcadeActions.toggleSound()} aria-label={soundEnabled ? "Desativar som" : "Ativar som"} className="flex size-10 items-center justify-center rounded-full border-2 border-yellow-400 bg-[#7e0709]/90 text-yellow-100">{soundEnabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}</button>
            <button type="button" aria-label="Música" className="flex size-10 items-center justify-center rounded-full border-2 border-yellow-400 bg-[#7e0709]/90 text-yellow-100"><Music2 className="size-5" /></button>
          </div>

          <div className="absolute left-4 top-[66px] z-20">
            <p className="font-serif text-[13px] font-black italic tracking-[.08em] text-orange-200">FORTUNE</p>
            <h1 className="-mt-1 font-serif text-[42px] font-black italic leading-[.78] text-yellow-100 drop-shadow-[0_4px_0_#9c210b]">GOLDEN<br />TIGER</h1>
          </div>

          <div className="absolute left-1/2 top-[36px] z-20 size-[156px] -translate-x-1/2">
            <div className="absolute inset-0 rounded-full bg-orange-300/25 blur-2xl" />
            <GoldenTigerSymbol id="wild" />
            <div className="absolute -right-4 top-7 size-[60px] rotate-6"><GoldenTigerSymbol id="scatter" /></div>
          </div>

          <div className="absolute right-3 top-[68px] z-20 w-[132px] space-y-1 text-center font-black">
            <div className="rounded-xl border-2 border-yellow-300 bg-[#7d0808]/95 px-2 py-1 shadow-[0_0_13px_rgba(255,187,42,.48)]"><span className="block text-[9px] text-yellow-200">GRAND JACKPOT</span><span className="text-[15px] text-yellow-100">1.250.000</span></div>
            <div className="rounded-lg border border-fuchsia-300 bg-[#681270]/95 px-2 py-0.5 text-[11px] text-fuchsia-100">MAJOR 125.000</div>
            <div className="rounded-lg border border-cyan-300 bg-[#075a89]/95 px-2 py-0.5 text-[11px] text-cyan-100">MINOR 25.000</div>
            <div className="rounded-lg border border-emerald-300 bg-[#086526]/95 px-2 py-0.5 text-[11px] text-emerald-100">MINI 5.000</div>
          </div>

          <div className="absolute inset-x-3 bottom-1 z-30 flex h-12 items-center justify-center gap-2 rounded-[18px] border-2 border-yellow-400 bg-[linear-gradient(180deg,#b32212,#6f0608)] px-3 text-center shadow-[0_0_18px_rgba(255,148,26,.55)]">
            <div className="size-9 shrink-0"><GoldenTigerSymbol id="scatter" /></div>
            <span className="font-serif text-[18px] font-black italic text-yellow-100 drop-shadow-[0_2px_0_#6e0c07]">3 CARTINHAS ATIVAM <span className="text-[#fff37a]">FREE SPINS!</span></span>
          </div>
        </div>

        <div className="relative px-5 pt-2">
          <div className="absolute left-0 top-3 z-30 flex h-[300px] w-5 flex-col items-center justify-around py-1">{PAYLINE_LABELS.map((label) => <span key={`l-${label}`} className="flex size-5 items-center justify-center rounded-full border border-yellow-300 bg-[#8a120b] text-[9px] font-black text-yellow-100">{label}</span>)}</div>
          <div className="absolute right-0 top-3 z-30 flex h-[300px] w-5 flex-col items-center justify-around py-1">{PAYLINE_LABELS.map((label) => <span key={`r-${label}`} className="flex size-5 items-center justify-center rounded-full border border-yellow-300 bg-[#8a120b] text-[9px] font-black text-yellow-100">{label}</span>)}</div>

          <div className="relative grid h-[300px] grid-cols-5 grid-rows-3 overflow-hidden rounded-[16px] border-[3px] border-yellow-400 bg-[#2a0208] shadow-[inset_0_0_30px_rgba(0,0,0,.85),0_0_24px_rgba(255,159,31,.32)]">
            {grid.map((id, index) => {
              const column = index % 5;
              const row = Math.floor(index / 5);
              const cellSpinning = spinning && column >= stoppedColumns;
              const anticipating = cellSpinning && anticipationScatters > 0;
              const landed = spinning && landingColumn === column;
              const isScatter = !spinning && scatterIndexes.has(index);
              return (
                <div key={`${index}-${id}`} className={cn("relative overflow-hidden border border-yellow-500/45 bg-[#3c0309]", anticipating && "gt4-anticipation", winning.has(index) && !spinning && "ring-2 ring-inset ring-yellow-200") }>
                  <ReelWindow id={id} column={column} row={row} spinning={cellSpinning} slow={anticipating} landed={landed} winning={winning.has(index) && !spinning} scatter={isScatter} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative mx-5 mt-2 h-[66px]">
          {anticipationText ? (
            <div className="gt4-anticipation-banner absolute left-1/2 top-1/2 z-40 w-[96%] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-yellow-300 bg-[linear-gradient(180deg,#9e130c,#4c0307)] px-3 py-2 text-center shadow-[0_0_28px_rgba(255,68,34,.8)]">
              <p className="font-serif text-[16px] font-black italic text-yellow-100">{anticipationText}</p>
              <p className="text-[9px] font-bold uppercase tracking-[.16em] text-orange-200">as próximas colunas desaceleram</p>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl border border-yellow-500/45 bg-[#3b0508]/85 px-3">
              <div className="size-10"><GoldenTigerSymbol id="scatter" /></div>
              <div className="flex gap-1.5">
                {Array.from({ length: 5 }, (_, index) => <span key={index} className={cn("size-6 rounded-full border-2", index < stoppedScatterCount ? "border-yellow-200 bg-[radial-gradient(circle,#fff8a8,#ffae22_55%,#a42e04)] shadow-[0_0_13px_rgba(255,180,35,.8)]" : "border-yellow-900/70 bg-black/45")} />)}
              </div>
              <span className="text-[10px] font-black uppercase tracking-[.12em] text-yellow-100">Cartinhas</span>
            </div>
          )}
        </div>

        <div className="mx-3 grid grid-cols-[1fr_1.2fr_1fr] gap-2">
          <div className="rounded-2xl border border-yellow-500/55 bg-[#220306] px-2 py-2 text-center"><p className="text-[9px] font-black uppercase tracking-[.13em] text-yellow-300">Saldo</p><p className="text-sm font-black tabular-nums text-white">{formatCoins(balance)}</p></div>
          <div className={cn("rounded-2xl border border-yellow-400 bg-[linear-gradient(180deg,#7b0b08,#3c0306)] px-2 py-2 text-center shadow-[0_0_16px_rgba(255,143,28,.35)]", win > 0 && !spinning && "gt4-winning")}><p className="text-[9px] font-black uppercase tracking-[.13em] text-yellow-200">Ganho</p><p className="font-serif text-xl font-black tabular-nums text-yellow-100">{formatCoins(win)}</p></div>
          <div className="rounded-2xl border border-yellow-500/55 bg-[#220306] px-2 py-2 text-center"><p className="text-[9px] font-black uppercase tracking-[.13em] text-yellow-300">Aposta</p><div className="flex items-center justify-center gap-1"><button type="button" onClick={() => changeBet(-1)} disabled={spinning || bonusActive || autoLeft > 0} className="flex size-5 items-center justify-center rounded-full border border-yellow-400 text-yellow-200">−</button><p className="text-sm font-black tabular-nums">{formatCoins(bet)}</p><button type="button" onClick={() => changeBet(1)} disabled={spinning || bonusActive || autoLeft > 0} className="flex size-5 items-center justify-center rounded-full border border-yellow-400 text-yellow-200">+</button></div></div>
        </div>

        <div className="relative mx-3 mt-2 h-[128px]">
          <button type="button" onClick={() => setTurbo((value) => !value)} aria-pressed={turbo} className={cn("absolute bottom-3 left-0 flex h-[58px] w-[72px] flex-col items-center justify-center rounded-2xl border-2 border-yellow-500 bg-[linear-gradient(180deg,#7d0d09,#3a0305)] text-yellow-100 shadow-lg", turbo && "ring-2 ring-yellow-200 shadow-[0_0_24px_rgba(255,212,62,.75)]")}><Zap className="size-6" /><span className="text-[9px] font-black">TURBO</span></button>

          {autoLeft > 0 ? (
            <button type="button" onClick={() => { stopAutoRef.current = true; }} className="absolute bottom-3 left-[78px] flex h-[58px] w-[72px] flex-col items-center justify-center rounded-2xl border-2 border-yellow-500 bg-[linear-gradient(180deg,#12633d,#062d1d)] text-yellow-100"><RotateCw className="size-5" /><span className="text-[9px] font-black">PARAR {autoLeft}</span></button>
          ) : (
            <button type="button" onClick={() => void startAuto()} disabled={spinning || bonusActive || insufficient} className="absolute bottom-3 left-[78px] flex h-[58px] w-[72px] flex-col items-center justify-center rounded-2xl border-2 border-yellow-500 bg-[linear-gradient(180deg,#7d0d09,#3a0305)] text-yellow-100 disabled:opacity-45"><RotateCw className="size-5" /><span className="text-[9px] font-black">AUTO PLAY</span></button>
          )}

          <div className="gt4-fire-ring pointer-events-none absolute bottom-[-1px] left-1/2 z-10 size-[128px] -translate-x-1/2 rounded-full bg-[conic-gradient(from_0deg,#ff6b15,#ffd431,#ff2d11,#ff9d18,#fff176,#ff4a13,#ff6b15)] p-[7px] shadow-[0_0_34px_rgba(255,105,18,.9)]">
            <div className="size-full rounded-full bg-[#4c0903]" />
          </div>
          <button type="button" onClick={() => void spin()} disabled={spinning || bonusActive || autoLeft > 0 || insufficient} aria-label="Girar Golden Tiger" className={cn("absolute bottom-2 left-1/2 z-20 flex size-[112px] -translate-x-1/2 items-center justify-center rounded-full border-[5px] border-yellow-300 bg-[radial-gradient(circle_at_42%_35%,#74ef5f,#119b35_55%,#04521e)] text-yellow-100 disabled:opacity-45", spinning ? "shadow-[0_0_42px_rgba(67,255,91,.92)]" : "gt4-spin-idle")}>
            <RotateCw className={cn("size-16 stroke-[3.2] drop-shadow-[0_3px_0_#805600]", spinning && "gt4-spin-arrow")} />
          </button>

          <button type="button" onClick={setMaxBet} disabled={spinning || bonusActive || autoLeft > 0} className="absolute bottom-3 right-0 flex h-[58px] w-[88px] flex-col items-center justify-center rounded-2xl border-2 border-yellow-500 bg-[linear-gradient(180deg,#7d0d09,#3a0305)] text-yellow-100 disabled:opacity-45"><Coins className="size-5" /><span className="text-[10px] font-black">MAX BET</span></button>
        </div>

        <p className="pb-3 text-center text-[8px] font-bold uppercase tracking-[.2em] text-yellow-200/55">Moedas fictícias · sem valor real</p>

        {showWinFx && <div className="gt4-win-flash pointer-events-none absolute inset-0 z-[60]" />}
        {showWinFx && <div className="pointer-events-none absolute inset-0 z-[61] overflow-hidden">{PARTICLES.map((particle, index) => <span key={index} className="gt4-particle absolute top-[73%] size-2 rounded-full border border-yellow-100 bg-yellow-300 shadow-[0_0_10px_rgba(255,215,75,.9)]" style={{ left: `${particle.left}%`, animationDelay: `${particle.delay}ms`, ["--particle-drift" as string]: `${particle.drift}px` }} />)}</div>}
        {bigWin && showWinFx && <div className="pointer-events-none absolute left-1/2 top-[52%] z-[65] -translate-x-1/2 rounded-2xl border-2 border-yellow-200 bg-red-950/90 px-5 py-3 text-center font-serif text-3xl font-black text-yellow-100 shadow-[0_0_45px_rgba(255,199,39,.9)]">BIG WIN!</div>}

        {bonusActive && <div className="absolute left-1/2 top-[246px] z-50 -translate-x-1/2 rounded-full border border-yellow-200 bg-red-950/92 px-3 py-1 text-[10px] font-black uppercase tracking-[.13em] text-yellow-100 shadow-[0_0_20px_rgba(255,169,29,.65)]">FREE SPINS {bonusSpinsLeft} · +{formatCoins(bonusWin)}</div>}

        {bonusIntro !== null && <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/65 backdrop-blur-[2px]"><div className="mx-5 w-full rounded-[28px] border-2 border-yellow-300 bg-[radial-gradient(circle_at_50%_20%,#df321a,#740609_66%,#280003)] px-5 py-8 text-center shadow-[0_0_60px_rgba(255,170,35,.85)]"><div className="mx-auto mb-3 size-20"><GoldenTigerSymbol id="scatter" /></div><p className="text-xs font-black uppercase tracking-[.2em] text-yellow-200">Cartinhas da Fortuna</p><p className="mt-1 font-serif text-6xl font-black text-yellow-100">{bonusIntro}</p><p className="font-serif text-xl font-black text-yellow-300">FREE SPINS</p><p className="mt-3 text-xs text-yellow-50/75">Sem desconto de aposta durante o bônus.</p></div></div>}
        {bonusSummary !== null && <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-[2px]"><div className="mx-5 w-full rounded-[28px] border-2 border-emerald-300 bg-[radial-gradient(circle_at_50%_20%,#167a49,#042b1c_72%,#010805)] px-5 py-8 text-center shadow-[0_0_55px_rgba(57,255,152,.5)]"><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-200">Bônus concluído</p><p className="mt-2 font-serif text-4xl font-black text-yellow-200">{formatCoins(bonusSummary)}</p><p className="mt-1 text-sm font-black text-emerald-100">GANHO TOTAL</p></div></div>}

        {!bonusActive && insufficient && <div className="absolute inset-x-6 bottom-3 z-[70] rounded-xl border border-red-300 bg-red-950/95 px-3 py-2 text-center text-[10px] font-semibold text-red-50">Saldo fictício insuficiente. Recarregue moedas grátis no lobby.</div>}
      </section>
    </main>
  );
}
