import { Link } from "@tanstack/react-router";
import { ArrowLeft, RotateCw, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { goldenTigerCabinet } from "@/assets/golden-tiger/cabinetData";
import {
  GoldenTigerSymbolArtV3,
  type GoldenTigerSymbolId,
} from "@/components/arcade/GoldenTigerSymbolArtV3";
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
  { left: 6.2, top: 22.7, width: 28.1, height: 15.6 },
  { left: 35.4, top: 22.7, width: 28.8, height: 15.6 },
  { left: 65.25, top: 22.7, width: 28.7, height: 15.6 },
  { left: 6.2, top: 38.95, width: 28.1, height: 15.6 },
  { left: 35.4, top: 38.95, width: 28.8, height: 15.6 },
  { left: 65.25, top: 38.95, width: 28.7, height: 15.6 },
  { left: 6.2, top: 55.15, width: 28.1, height: 15.55 },
  { left: 35.4, top: 55.15, width: 28.8, height: 15.55 },
  { left: 65.25, top: 55.15, width: 28.7, height: 15.55 },
] as const;

const PARTICLES = Array.from({ length: 24 }, (_, index) => ({
  left: 7 + ((index * 19) % 86),
  delay: (index % 8) * 58,
  duration: 760 + (index % 6) * 100,
}));

type SymbolId = GoldenTigerSymbolId;
type AnticipationLevel = 0 | 1 | 2;

type SymbolDef = {
  id: SymbolId;
  label: string;
  weight: number;
  pay: number;
};

type SpinResult = {
  payout: number;
  lines: number;
  winning: Set<number>;
  scatterIndexes: Set<number>;
  scatterCount: number;
  bonusAward: number;
};

const SYMBOLS: readonly SymbolDef[] = [
  { id: "tiger", label: "Tigrinho da Fortuna", weight: 5, pay: 10 },
  { id: "ingot", label: "Lingote Dourado", weight: 8, pay: 7 },
  { id: "envelope", label: "Cartinha da Sorte", weight: 9, pay: 5 },
  { id: "orange", label: "Laranja da Sorte", weight: 14, pay: 4 },
  { id: "moneybag", label: "Bolsa da Fortuna", weight: 15, pay: 3.2 },
  { id: "firecrackers", label: "Fogos da Sorte", weight: 17, pay: 2.7 },
  { id: "jade", label: "Jade Imperial", weight: 18, pay: 2.2 },
  { id: "lantern", label: "Lanterna Imperial", weight: 20, pay: 1.8 },
];

const BY_ID = new Map<SymbolId, SymbolDef>(SYMBOLS.map((symbol) => [symbol.id, symbol]));
const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
const INITIAL_GRID: SymbolId[] = [
  "ingot",
  "envelope",
  "jade",
  "moneybag",
  "tiger",
  "firecrackers",
  "orange",
  "lantern",
  "ingot",
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
  return "lantern";
}

function makeGrid(): SymbolId[] {
  return Array.from({ length: 9 }, pickSymbol);
}

function bonusForScatterCount(count: number) {
  if (count >= 5) return 20;
  if (count === 4) return 12;
  if (count === 3) return 8;
  return 0;
}

function evaluate(grid: readonly SymbolId[], bet: number): SpinResult {
  let payout = 0;
  let lines = 0;
  const winning = new Set<number>();
  const scatterIndexes = new Set<number>();

  grid.forEach((id, index) => {
    if (id === "envelope") scatterIndexes.add(index);
  });

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

  const scatterCount = scatterIndexes.size;
  return {
    payout: Math.round(payout),
    lines,
    winning,
    scatterIndexes,
    scatterCount,
    bonusAward: bonusForScatterCount(scatterCount),
  };
}

function scattersInColumns(grid: readonly SymbolId[], maxColumn: number) {
  const indexes = new Set<number>();
  grid.forEach((id, index) => {
    if (index % 3 <= maxColumn && id === "envelope") indexes.add(index);
  });
  return indexes;
}

function ReelCell({
  id,
  spinning,
  winning,
  scatter,
  justLanded,
  row,
  anticipation,
}: {
  id: SymbolId;
  spinning: boolean;
  winning: boolean;
  scatter: boolean;
  justLanded: boolean;
  row: number;
  anticipation: AnticipationLevel;
}) {
  if (spinning) {
    const stream: SymbolId[] = [pickSymbol(), pickSymbol(), pickSymbol(), pickSymbol(), pickSymbol()];
    const animation = anticipation > 0
      ? "motion-safe:animate-[tiger-symbol-fall-suspense_520ms_linear_infinite]"
      : "motion-safe:animate-[tiger-symbol-fall_330ms_linear_infinite]";

    return (
      <div className="absolute inset-0 overflow-hidden bg-[#710c08]">
        <div
          className={cn("absolute inset-x-[3%] -top-[400%] h-[500%]", animation)}
          style={{ animationDelay: `${row * -65}ms` }}
        >
          {stream.map((symbol, index) => (
            <div key={`${symbol}-${index}`} className="flex h-1/5 items-center justify-center p-[4%]">
              <GoldenTigerSymbolArtV3 id={symbol} compact />
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(75,0,0,.78),transparent_20%,transparent_76%,rgba(62,0,0,.78))]" />
        {anticipation > 0 && (
          <div className={cn(
            "pointer-events-none absolute inset-0 border-2 border-yellow-300/70 shadow-[inset_0_0_28px_rgba(255,181,40,.45),0_0_22px_rgba(255,181,40,.55)]",
            anticipation === 2 && "border-orange-200 shadow-[inset_0_0_34px_rgba(255,78,20,.55),0_0_30px_rgba(255,92,25,.75)]",
          )} />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "absolute inset-0 p-[3.5%]",
        justLanded && "motion-safe:animate-[tiger-piece-land_390ms_cubic-bezier(.18,.9,.2,1.35)_both]",
        winning && "motion-safe:animate-[tiger-win-cell_850ms_ease-in-out_infinite]",
        scatter && "motion-safe:animate-[tiger-scatter-pulse_700ms_ease-in-out_infinite]",
      )}
      style={justLanded ? { animationDelay: `${row * 55}ms` } : undefined}
    >
      <GoldenTigerSymbolArtV3 id={id} />
    </div>
  );
}

function useCabinetBlob() {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    try {
      const commaIndex = goldenTigerCabinet.indexOf(",");
      if (commaIndex < 0) throw new Error("Cabinet data is invalid");
      const base64 = goldenTigerCabinet.slice(commaIndex + 1);
      const binary = window.atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      objectUrl = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: "image/jpeg" }));
      setSrc(objectUrl);
      setFailed(false);
    } catch {
      setFailed(true);
    }

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return { src, failed };
}

export function GoldenTigerCabinetV3() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const { src: cabinetSrc, failed: cabinetFailed } = useCabinetBlob();

  const [bet, setBet] = useState<number>(200);
  const [grid, setGrid] = useState<SymbolId[]>(INITIAL_GRID);
  const [win, setWin] = useState(2450);
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [scatterIndexes, setScatterIndexes] = useState<Set<number>>(() => new Set());
  const [spinning, setSpinning] = useState(false);
  const [stoppedColumns, setStoppedColumns] = useState(3);
  const [landingColumn, setLandingColumn] = useState(-1);
  const [anticipationLevel, setAnticipationLevel] = useState<AnticipationLevel>(0);
  const [hasSpun, setHasSpun] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [showWinFx, setShowWinFx] = useState(false);
  const [bonusActive, setBonusActive] = useState(false);
  const [bonusSpinsLeft, setBonusSpinsLeft] = useState(0);
  const [bonusWin, setBonusWin] = useState(0);
  const [bonusIntro, setBonusIntro] = useState<number | null>(null);
  const [retriggerAward, setRetriggerAward] = useState<number | null>(null);
  const [bonusSummary, setBonusSummary] = useState<number | null>(null);

  const busyRef = useRef(false);
  const stopRef = useRef(false);
  const bonusActiveRef = useRef(false);

  useEffect(() => hydrateFromStorage(), []);

  const spinRound = useCallback(
    async (freeSpin: boolean): Promise<SpinResult | null> => {
      if (busyRef.current) return null;
      if (!freeSpin && !arcadeActions.placeBet(bet)) {
        playSound("lose", soundEnabled);
        return null;
      }

      busyRef.current = true;
      setHasSpun(true);
      setSpinning(true);
      setStoppedColumns(0);
      setLandingColumn(-1);
      setAnticipationLevel(0);
      setWin(0);
      setWinning(new Set());
      setScatterIndexes(new Set());
      setShowWinFx(false);
      playSound("spin", soundEnabled);

      const finalGrid = makeGrid();
      const result = evaluate(finalGrid, bet);
      const firstStopDelay = turbo ? 210 : 720;
      const normalGap = turbo ? 100 : 230;

      await wait(firstStopDelay);
      let scatterSeen = 0;

      for (let column = 0; column < 3; column += 1) {
        setStoppedColumns(column + 1);
        setLandingColumn(column);
        setGrid((current) =>
          current.map((id, index) => (index % 3 <= column ? (finalGrid[index] ?? id) : id)),
        );

        const visibleScatters = scattersInColumns(finalGrid, column);
        setScatterIndexes(visibleScatters);
        scatterSeen = visibleScatters.size;
        playSound("tick", soundEnabled);

        if (column < 2 && scatterSeen > 0) {
          const level: AnticipationLevel = scatterSeen >= 2 ? 2 : 1;
          setAnticipationLevel(level);
          playSound("anticipation", soundEnabled);
          await wait(turbo ? (level === 2 ? 380 : 270) : level === 2 ? 1_180 : 760);
        } else {
          setAnticipationLevel(0);
          await wait(normalGap);
        }
      }

      setGrid(finalGrid);
      setScatterIndexes(result.scatterIndexes);
      setLandingColumn(-1);
      setAnticipationLevel(0);

      if (result.payout > 0) arcadeActions.credit(result.payout);
      arcadeActions.recordRound({
        slug: "golden-tiger",
        gameName: "Golden Tiger",
        bet: freeSpin ? 0 : bet,
        payout: result.payout,
        multiplier: result.payout > 0 ? result.payout / bet : 0,
        note: freeSpin
          ? `FREE SPIN · ${result.lines} linha${result.lines === 1 ? "" : "s"} · ${result.scatterCount} cartinha${result.scatterCount === 1 ? "" : "s"}`
          : `${result.lines} linha${result.lines === 1 ? "" : "s"} · ${result.scatterCount} cartinha${result.scatterCount === 1 ? "" : "s"}`,
      });

      setWin(result.payout);
      setWinning(result.winning);
      setSpinning(false);
      setStoppedColumns(3);
      busyRef.current = false;

      if (result.payout > 0) {
        setShowWinFx(true);
        window.setTimeout(() => setShowWinFx(false), result.payout >= bet * 10 ? 1_800 : 1_150);
      }

      playSound(result.payout >= bet * 10 ? "bigWin" : result.payout > 0 ? "win" : "lose", soundEnabled);
      return result;
    },
    [bet, soundEnabled, turbo],
  );

  const runBonus = useCallback(
    async (initialAward: number) => {
      if (initialAward <= 0 || bonusActiveRef.current) return;
      bonusActiveRef.current = true;
      setBonusActive(true);
      setBonusWin(0);
      setBonusSpinsLeft(initialAward);
      setBonusIntro(initialAward);
      playSound("bonus", soundEnabled);
      await wait(turbo ? 700 : 1_250);
      setBonusIntro(null);

      let remaining = initialAward;
      let totalBonusWin = 0;
      while (remaining > 0) {
        setBonusSpinsLeft(remaining);
        await wait(turbo ? 130 : 320);
        const result = await spinRound(true);
        if (!result) break;
        totalBonusWin += result.payout;
        setBonusWin(totalBonusWin);
        remaining -= 1;

        if (result.bonusAward > 0) {
          remaining += result.bonusAward;
          setRetriggerAward(result.bonusAward);
          setBonusSpinsLeft(remaining);
          playSound("bonus", soundEnabled);
          await wait(turbo ? 620 : 1_050);
          setRetriggerAward(null);
        }
        setBonusSpinsLeft(remaining);
      }

      setBonusSummary(totalBonusWin);
      playSound("cash", soundEnabled);
      await wait(turbo ? 900 : 1_700);
      setBonusSummary(null);
      setBonusSpinsLeft(0);
      setBonusActive(false);
      bonusActiveRef.current = false;
    },
    [soundEnabled, spinRound, turbo],
  );

  const spin = useCallback(async (): Promise<boolean> => {
    if (busyRef.current || bonusActiveRef.current) return false;
    const result = await spinRound(false);
    if (!result) return false;
    if (result.bonusAward > 0) await runBonus(result.bonusAward);
    return true;
  }, [runBonus, spinRound]);

  const startAuto = useCallback(async () => {
    if (busyRef.current || bonusActiveRef.current || autoLeft > 0) return;
    stopRef.current = false;
    for (let remaining = 10; remaining > 0; remaining -= 1) {
      if (stopRef.current) break;
      setAutoLeft(remaining);
      const played = await spin();
      if (!played) break;
      await wait(turbo ? 180 : 390);
    }
    setAutoLeft(0);
  }, [autoLeft, spin, turbo]);

  const betIndex = BET_STEPS.findIndex((value) => value === bet);
  const insufficient = bet > balance;

  const changeBet = (direction: -1 | 1) => {
    if (spinning || autoLeft > 0 || bonusActive) return;
    const safeIndex = betIndex < 0 ? 0 : betIndex;
    const nextIndex = Math.max(0, Math.min(BET_STEPS.length - 1, safeIndex + direction));
    const nextBet = BET_STEPS[nextIndex];
    if (nextBet !== undefined) setBet(nextBet);
  };

  const setMaxBet = () => {
    if (spinning || autoLeft > 0 || bonusActive) return;
    const affordable = [...BET_STEPS].reverse().find((value) => value <= balance);
    if (affordable !== undefined) setBet(affordable);
  };

  const bigWin = win >= bet * 10 && !spinning;
  const anticipationText = anticipationLevel === 2 ? "2 CARTINHAS... FALTA SÓ 1!" : "1 CARTINHA... SERÁ QUE VEM MAIS?";

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#050302] sm:px-4 sm:py-3">
      <div
        className={cn(
          "relative mx-auto aspect-[941/1672] w-full max-w-[430px] overflow-hidden bg-[#2e0704] shadow-[0_0_90px_rgba(0,0,0,.95)] sm:rounded-[24px] sm:ring-1 sm:ring-yellow-500/25",
          bigWin && "motion-safe:animate-[tiger-cabinet-impact_560ms_ease-out_1]",
          bonusActive && "ring-2 ring-yellow-300/60",
          anticipationLevel > 0 && "motion-safe:animate-[tiger-anticipation-cabinet_820ms_ease-in-out_infinite]",
        )}
      >
        {cabinetSrc ? (
          <img src={cabinetSrc} alt="Golden Tiger" className="absolute inset-0 size-full select-none object-fill" draggable={false} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#250301] px-8 text-center text-sm font-semibold text-yellow-100">
            {cabinetFailed ? "Falha ao carregar a arte do Golden Tiger." : "Carregando Golden Tiger…"}
          </div>
        )}

        <div className="absolute left-[1.4%] top-[1.1%] z-50 flex gap-1.5">
          <Link to="/" aria-label="Voltar ao lobby" className="flex size-8 items-center justify-center rounded-full border border-yellow-300/80 bg-black/65 text-yellow-100 shadow-lg backdrop-blur-sm">
            <ArrowLeft className="size-4" />
          </Link>
          <button type="button" onClick={() => arcadeActions.toggleSound()} aria-label={soundEnabled ? "Desativar som" : "Ativar som"} className="flex size-8 items-center justify-center rounded-full border border-yellow-300/80 bg-black/65 text-yellow-100 shadow-lg backdrop-blur-sm">
            {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
        </div>

        {bonusActive && (
          <div className="absolute left-1/2 top-[17.8%] z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-yellow-200/80 bg-red-950/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-yellow-100 shadow-[0_0_22px_rgba(255,184,36,.55)] backdrop-blur-sm">
            <Sparkles className="size-3 text-yellow-300" /> Free Spins {bonusSpinsLeft}
            <span className="text-emerald-300">+{formatCoins(bonusWin)}</span>
          </div>
        )}

        {anticipationLevel > 0 && spinning && (
          <div className={cn(
            "absolute left-1/2 top-[18.1%] z-[58] -translate-x-1/2 rounded-full border border-yellow-200 bg-black/80 px-3 py-1.5 text-center text-[10px] font-black tracking-[0.08em] text-yellow-100 shadow-[0_0_30px_rgba(255,169,30,.75)] backdrop-blur-sm motion-safe:animate-[tiger-anticipation-banner_620ms_ease-in-out_infinite]",
            anticipationLevel === 2 && "border-orange-200 text-orange-100 shadow-[0_0_40px_rgba(255,65,24,.85)]",
          )}>
            {anticipationText}
          </div>
        )}

        {(hasSpun || spinning) && grid.map((id, index) => {
          const box = CELL_BOXES[index];
          if (!box) return null;
          const column = index % 3;
          const row = Math.floor(index / 3);
          const cellSpinning = spinning && column >= stoppedColumns;
          const justLanded = spinning && landingColumn === column;
          const isScatter = scatterIndexes.has(index);
          const cellAnticipation: AnticipationLevel = cellSpinning ? anticipationLevel : 0;

          return (
            <div
              key={`${index}-${id}`}
              className={cn(
                "absolute z-20 overflow-hidden bg-[#710c08]",
                winning.has(index) && !spinning && "ring-2 ring-inset ring-yellow-200 shadow-[0_0_28px_rgba(255,216,75,.9)]",
                isScatter && "ring-2 ring-inset ring-orange-200 shadow-[0_0_36px_rgba(255,75,26,.95)]",
                cellAnticipation > 0 && "z-30 motion-safe:animate-[tiger-anticipation-reel_650ms_ease-in-out_infinite]",
              )}
              style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
            >
              <ReelCell
                id={id}
                spinning={cellSpinning}
                winning={winning.has(index)}
                scatter={isScatter}
                justLanded={justLanded}
                row={row}
                anticipation={cellAnticipation}
              />
            </div>
          );
        })}

        {showWinFx && (
          <>
            <div className="pointer-events-none absolute inset-0 z-[35] motion-safe:animate-[tiger-win-flash_520ms_ease-out_1]" />
            <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
              {PARTICLES.map((particle, index) => (
                <span key={index} className="absolute top-[70%] size-2 rounded-full border border-yellow-100/70 bg-yellow-300 shadow-[0_0_12px_rgba(255,211,65,.95)] motion-safe:animate-[tiger-coin-burst_900ms_ease-out_forwards]" style={{ left: `${particle.left}%`, animationDelay: `${particle.delay}ms`, animationDuration: `${particle.duration}ms` }} />
              ))}
            </div>
          </>
        )}

        {bigWin && showWinFx && (
          <div className="pointer-events-none absolute inset-x-[8%] top-[45%] z-50 text-center font-serif text-[clamp(2rem,12vw,4rem)] font-black text-yellow-200 drop-shadow-[0_5px_0_#8b2c00] motion-safe:animate-[tiger-big-win-text_1.35s_ease-out_forwards]">BIG WIN!</div>
        )}

        {hasSpun && (
          <div className={cn("absolute z-30 flex items-center justify-center rounded-[18%] bg-[radial-gradient(ellipse_at_center,#087b42,#034326_72%)] px-2 text-center", win > 0 && !spinning && "motion-safe:animate-[tiger-win-banner_900ms_ease-in-out_infinite]")} style={{ left: "27.2%", top: "74.6%", width: "45.6%", height: "4.45%" }} role="status" aria-live="polite">
            <span className="font-serif text-[clamp(1.3rem,6.6vw,2rem)] font-black tabular-nums text-[#ffd74f] drop-shadow-[0_2px_0_#704000]">{formatCoins(win)}</span>
          </div>
        )}

        <div className="absolute z-30 flex items-center justify-center bg-[#170b08] px-1" style={{ left: "5.2%", top: "84.45%", width: "26.8%", height: "3.75%" }}><span className="text-[clamp(.78rem,4.4vw,1.12rem)] font-bold tabular-nums text-white">{formatCoins(balance)}</span></div>
        <div className="absolute z-30 flex items-center justify-center bg-[#170b08] px-1" style={{ left: "68.25%", top: "84.45%", width: "25.6%", height: "3.75%" }}><span className="text-[clamp(.78rem,4.4vw,1.12rem)] font-bold tabular-nums text-white">{formatCoins(bet)}</span></div>

        <button type="button" onClick={() => setTurbo((value) => !value)} aria-label="Alternar modo turbo" aria-pressed={turbo} className={cn("absolute z-40 rounded-full", turbo && "shadow-[0_0_25px_rgba(255,222,66,.95)] ring-2 ring-yellow-200/90")} style={{ left: "87.1%", top: "74.65%", width: "9.3%", height: "5.25%" }} />
        <button type="button" aria-label="Informações do jogo" title="3 cartinhas = 8 free spins; 4 = 12; 5 ou mais = 20." className="absolute z-40 rounded-full" style={{ left: "3.4%", top: "74.65%", width: "9.3%", height: "5.25%" }} />
        <button type="button" onClick={() => changeBet(-1)} disabled={spinning || autoLeft > 0 || bonusActive} aria-label="Diminuir aposta" className="absolute z-40 rounded-full disabled:cursor-not-allowed" style={{ left: "66.2%", top: "84.3%", width: "7.8%", height: "4.55%" }} />
        <button type="button" onClick={() => changeBet(1)} disabled={spinning || autoLeft > 0 || bonusActive} aria-label="Aumentar aposta" className="absolute z-40 rounded-full disabled:cursor-not-allowed" style={{ left: "90.35%", top: "84.3%", width: "7.8%", height: "4.55%" }} />

        <button type="button" onClick={() => void spin()} disabled={spinning || autoLeft > 0 || bonusActive || insufficient || !cabinetSrc} aria-label="Girar Golden Tiger" className={cn("absolute z-40 rounded-full transition duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45", spinning ? "shadow-[0_0_42px_rgba(86,255,104,.95)] ring-4 ring-yellow-200/80 motion-safe:animate-[tiger-spin-active_520ms_ease-in-out_infinite]" : "motion-safe:animate-[tiger-spin-pulse_1.8s_ease-in-out_infinite]")} style={{ left: "32.2%", top: "81.05%", width: "35.7%", height: "17.9%" }}>
          {spinning ? <RotateCw className="mx-auto size-[36%] animate-spin text-transparent" /> : null}
        </button>

        {autoLeft > 0 ? (
          <button type="button" onClick={() => { stopRef.current = true; }} aria-label={`Parar auto play, ${autoLeft} giros restantes`} className="absolute z-40 rounded-xl bg-black/15 ring-2 ring-inset ring-emerald-300/80" style={{ left: "4.4%", top: "91.0%", width: "26.6%", height: "5.55%" }}><span className="absolute right-1 top-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black text-white">{autoLeft}</span></button>
        ) : (
          <button type="button" onClick={() => void startAuto()} disabled={spinning || bonusActive || insufficient || !cabinetSrc} aria-label="Auto play de dez giros" className="absolute z-40 rounded-xl disabled:cursor-not-allowed disabled:opacity-45" style={{ left: "4.4%", top: "91.0%", width: "26.6%", height: "5.55%" }} />
        )}

        <button type="button" onClick={setMaxBet} disabled={spinning || autoLeft > 0 || bonusActive} aria-label="Aposta máxima" className="absolute z-40 rounded-xl disabled:cursor-not-allowed disabled:opacity-45" style={{ left: "69.2%", top: "91.0%", width: "26.2%", height: "5.55%" }} />

        {bonusIntro !== null && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
            <div className="mx-5 w-full rounded-[28px] border-2 border-yellow-300/90 bg-[radial-gradient(circle_at_50%_25%,#d73016,#770808_62%,#270000)] px-5 py-8 text-center shadow-[0_0_55px_rgba(255,178,38,.8)] motion-safe:animate-[tiger-bonus-burst_720ms_cubic-bezier(.2,.9,.2,1.2)_1]">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-yellow-200">Cartinhas da Sorte</p>
              <p className="mt-2 font-serif text-[clamp(2.5rem,13vw,4.8rem)] font-black leading-none text-yellow-100 drop-shadow-[0_5px_0_#8a2600]">{bonusIntro}</p>
              <p className="mt-2 font-serif text-xl font-black text-yellow-300">FREE SPINS</p>
              <p className="mt-3 text-xs font-semibold text-yellow-50/80">A aposta não é descontada durante o bônus.</p>
            </div>
          </div>
        )}

        {retriggerAward !== null && <div className="pointer-events-none absolute inset-0 z-[72] flex items-center justify-center bg-red-950/25"><div className="rounded-3xl border-2 border-yellow-200 bg-black/85 px-6 py-5 text-center shadow-[0_0_50px_rgba(255,202,44,.85)] motion-safe:animate-[tiger-bonus-burst_650ms_ease-out_1]"><p className="text-xs font-black uppercase tracking-[0.22em] text-orange-300">RETRIGGER!</p><p className="font-serif text-4xl font-black text-yellow-200">+{retriggerAward}</p><p className="text-sm font-black text-yellow-100">FREE SPINS</p></div></div>}

        {bonusSummary !== null && <div className="absolute inset-0 z-[75] flex items-center justify-center bg-black/65 backdrop-blur-[3px]"><div className="mx-5 w-full rounded-[28px] border-2 border-emerald-300/90 bg-[radial-gradient(circle_at_50%_20%,#117846,#052d1e_70%,#020b07)] px-5 py-8 text-center shadow-[0_0_58px_rgba(57,255,155,.55)] motion-safe:animate-[tiger-bonus-burst_720ms_ease-out_1]"><p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200">Bônus concluído</p><p className="mt-2 font-serif text-[clamp(2rem,11vw,4rem)] font-black text-yellow-200 drop-shadow-[0_4px_0_#725100]">{formatCoins(bonusSummary)}</p><p className="mt-1 text-sm font-black text-emerald-100">GANHO TOTAL NOS FREE SPINS</p></div></div>}

        {!bonusActive && insufficient && <div className="absolute inset-x-[8%] bottom-[1.2%] z-50 rounded-xl border border-red-300/80 bg-red-950/95 px-3 py-2 text-center text-[11px] font-semibold text-red-50">Saldo fictício insuficiente. Recarregue moedas grátis no lobby.</div>}
      </div>
    </main>
  );
}
