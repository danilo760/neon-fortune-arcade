import { Link } from "@tanstack/react-router";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";

import { AnimatedWinCounter } from "./AnimatedWinCounter";
import {
  useCallback,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { goldenTigerReferenceBase64 } from "@/assets/golden-tiger/referenceData";
import { formatCoins } from "@/lib/arcade/format";
import {
  GOLDEN_TIGER_MAX_RETRIGGERS,
  evaluateGoldenTiger,
  goldenTigerWinTier,
  makeGoldenTigerGrid,
  pickGoldenTigerSymbol,
  type GoldenTigerMode,
  type GoldenTigerSpinResult,
  type GoldenTigerSymbolId,
  type GoldenTigerWinTier,
} from "@/lib/arcade/goldenTigerMath";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import "./GoldenTigerReference.css";

type Crop = { x: number; y: number; w: number; h: number };
type PresentationPhase =
  | "idle"
  | "spinning"
  | "anticipation"
  | "landing"
  | "evaluating"
  | "smallWin"
  | "bigWin"
  | "bonusTrigger"
  | "bonusIntro"
  | "bonusPlaying"
  | "bonusRetrigger"
  | "bonusOutro";
type TigerReaction = "idle" | "notice" | "charge" | "throw" | "celebrate" | "miss";
type BonusOverlay = {
  title: string;
  value?: string;
  caption?: string;
  tone: "bonus" | "retrigger" | "outro";
} | null;

const FULL_W = 940;
const FULL_H = 1672;
const CELL_W = 160;
const CELL_H = 175;

const CROPS: Record<GoldenTigerSymbolId, Crop> = {
  ingot: { x: 63, y: 544, w: CELL_W, h: CELL_H },
  scatter: { x: 223, y: 544, w: CELL_W, h: CELL_H },
  orange: { x: 383, y: 544, w: CELL_W, h: CELL_H },
  fortuneBag: { x: 543, y: 544, w: CELL_W, h: CELL_H },
  firecracker: { x: 703, y: 544, w: CELL_W, h: CELL_H },
  wild: { x: 223, y: 719, w: CELL_W, h: CELL_H },
  lion: { x: 703, y: 719, w: CELL_W, h: CELL_H },
  jade: { x: 63, y: 894, w: CELL_W, h: CELL_H },
  lantern: { x: 543, y: 894, w: CELL_W, h: CELL_H },
};

const BET_STEPS = [10, 50, 100, 200, 500, 1_000, 5_000, 10_000] as const;

const INITIAL_GRID: GoldenTigerSymbolId[] = [
  "ingot",
  "scatter",
  "orange",
  "fortuneBag",
  "firecracker",
  "firecracker",
  "wild",
  "ingot",
  "scatter",
  "lion",
  "jade",
  "fortuneBag",
  "scatter",
  "lantern",
  "orange",
];

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function createPresentationRng() {
  let state = (Date.now() ^ 0x9e3779b9) >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return reduced;
}

function useReferenceBlob() {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    try {
      const binary = window.atob(goldenTigerReferenceBase64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
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

const ReferenceSymbol = memo(function ReferenceSymbol({ id, src }: { id: GoldenTigerSymbolId; src: string }) {
  const crop = CROPS[id];
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#4c0612]">
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
});

function NumberPatch({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "absolute z-30 flex items-center justify-center rounded-lg bg-[#270006]/95 px-1 font-black text-[#fff5cf] shadow-[inset_0_0_7px_rgba(255,202,55,.18)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function tierPhase(tier: GoldenTigerWinTier): PresentationPhase {
  return tier === "big" || tier === "mega" ? "bigWin" : tier === "small" || tier === "nice" ? "smallWin" : "evaluating";
}

function tierLabel(tier: GoldenTigerWinTier) {
  if (tier === "mega") return "MEGA WIN";
  if (tier === "big") return "BIG WIN";
  if (tier === "nice") return "NICE WIN";
  if (tier === "small") return "WIN";
  return null;
}

export function GoldenTigerReference() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const { src, failed } = useReferenceBlob();
  const reducedMotion = useReducedMotionPreference();

  const [bet, setBet] = useState<number>(200);
  const [grid, setGrid] = useState<GoldenTigerSymbolId[]>(INITIAL_GRID);
  const [win, setWin] = useState(0);
  const [winDuration, setWinDuration] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [stoppedColumns, setStoppedColumns] = useState(5);
  const [landingColumn, setLandingColumn] = useState(-1);
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [scatters, setScatters] = useState<Set<number>>(() => new Set());
  const [anticipation, setAnticipation] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [bonusActive, setBonusActive] = useState(false);
  const [bonusSpins, setBonusSpins] = useState(0);
  const [bonusWin, setBonusWin] = useState(0);
  const [bonusOverlay, setBonusOverlay] = useState<BonusOverlay>(null);
  const [phase, setPhase] = useState<PresentationPhase>("idle");
  const [tigerReaction, setTigerReaction] = useState<TigerReaction>("idle");
  const [flyingCardColumn, setFlyingCardColumn] = useState<number | null>(null);
  const [winTier, setWinTier] = useState<GoldenTigerWinTier>("none");

  const busyRef = useRef(false);
  const stoppedRef = useRef(5);
  const autoStopRef = useRef(false);
  const bonusRef = useRef(false);
  const rollingRef = useRef<number | null>(null);
  const presentationRngRef = useRef<() => number>(createPresentationRng());

  useEffect(() => hydrateFromStorage(), []);

  useEffect(
    () => () => {
      if (rollingRef.current !== null) window.clearInterval(rollingRef.current);
    },
    [],
  );

  const spinRound = useCallback(
    async (free: boolean): Promise<GoldenTigerSpinResult | null> => {
      if (busyRef.current) return null;
      if (!free && !arcadeActions.placeBet(bet)) {
        playSound("lose", soundEnabled);
        return null;
      }

      const mode: GoldenTigerMode = free ? "freeSpins" : "base";
      busyRef.current = true;
      setSpinning(true);
      setPhase("spinning");
      setTigerReaction("idle");
      setFlyingCardColumn(null);
      setStoppedColumns(0);
      stoppedRef.current = 0;
      setLandingColumn(-1);
      setWinning(new Set());
      setScatters(new Set());
      setAnticipation(0);
      setWinTier("none");
      setWinDuration(0);
      setWin(0);
      playSound("spin", soundEnabled);

      const finalGrid = makeGoldenTigerGrid(mode);
      const result = evaluateGoldenTiger(finalGrid, bet, mode);

      if (rollingRef.current !== null) window.clearInterval(rollingRef.current);
      rollingRef.current = window.setInterval(() => {
        setGrid((current) =>
          current.map((symbol, index) =>
            index % 5 < stoppedRef.current
              ? symbol
              : pickGoldenTigerSymbol(mode, presentationRngRef.current),
          ),
        );
      }, turbo ? 48 : 72);

      await wait(turbo ? 160 : 440);
      let revealedScatters = 0;
      let previousScatters = 0;
      let hadTwoScatters = false;
      let triggerCelebrated = false;

      for (let column = 0; column < 5; column += 1) {
        setPhase("landing");
        setGrid((current) =>
          current.map((symbol, index) =>
            index % 5 === column ? (finalGrid[index] ?? symbol) : symbol,
          ),
        );
        stoppedRef.current = column + 1;
        setStoppedColumns(column + 1);
        setLandingColumn(column);
        playSound("tick", soundEnabled);

        const revealedIndexes = new Set<number>();
        for (let index = 0; index < finalGrid.length; index += 1) {
          if (index % 5 <= column && finalGrid[index] === "scatter") revealedIndexes.add(index);
        }
        setScatters(revealedIndexes);
        revealedScatters = revealedIndexes.size;

        const columnsRemain = column < 4;
        const crossedFirst = previousScatters < 1 && revealedScatters >= 1;
        const crossedSecond = previousScatters < 2 && revealedScatters >= 2;
        const crossedThird = previousScatters < 3 && revealedScatters >= 3;

        if (crossedFirst) {
          setTigerReaction("notice");
          playSound("tigerScatter", soundEnabled);
          await wait(turbo ? 70 : 150);
        }

        if (crossedThird) {
          triggerCelebrated = true;
          setAnticipation(0);
          setPhase("bonusTrigger");
          setTigerReaction("celebrate");
          await wait(turbo ? 80 : 150);
          playSound(free ? "tigerScatter" : "tigerBonus", soundEnabled);
          await wait(turbo ? 240 : 480);
          if (columnsRemain) {
            setPhase("spinning");
            setTigerReaction("idle");
          }
        } else if (crossedSecond && columnsRemain) {
          hadTwoScatters = true;
          setAnticipation(2);
          setPhase("anticipation");
          setTigerReaction("charge");
          playSound("anticipation", soundEnabled);
          await wait(turbo ? 100 : 210);
          setTigerReaction("throw");
          setFlyingCardColumn(column + 1);
          playSound("tigerThrow", soundEnabled);
          await wait(turbo ? 230 : 440);
          playSound("tigerImpact", soundEnabled);
          await wait(turbo ? 90 : 180);
          setFlyingCardColumn(null);
          setTigerReaction("charge");
          await wait(turbo ? 160 : 360);
        } else if (columnsRemain && revealedScatters === 1) {
          setAnticipation(1);
          setPhase("anticipation");
          await wait(turbo ? 120 : 260);
        } else if (!crossedThird) {
          setAnticipation(0);
          await wait(turbo ? 70 : 160);
        }

        previousScatters = revealedScatters;
      }

      if (rollingRef.current !== null) {
        window.clearInterval(rollingRef.current);
        rollingRef.current = null;
      }
      setGrid(finalGrid);
      setLandingColumn(-1);
      setStoppedColumns(5);
      stoppedRef.current = 5;
      setAnticipation(0);
      setSpinning(false);
      setWinning(result.winning);
      setScatters(result.scatterIndexes);
      setPhase("evaluating");

      if (result.payout > 0) arcadeActions.credit(result.payout);
      arcadeActions.recordRound({
        slug: "golden-tiger",
        gameName: "Golden Tiger",
        bet: free ? 0 : bet,
        payout: result.payout,
        multiplier: result.payout > 0 ? result.payout / bet : 0,
        note: `${free ? "FREE SPIN · " : ""}${result.lines} linha(s) · ${result.scatterCount} cartinha(s)`,
      });

      if (hadTwoScatters && result.scatterCount < 3) {
        setTigerReaction("miss");
        playSound("tigerMiss", soundEnabled);
        await wait(turbo ? 90 : 210);
        setTigerReaction("idle");
      }

      if (result.bonusAward > 0) {
        setWinDuration(0);
        setWin(result.payout);
        setPhase("bonusTrigger");
        setTigerReaction("celebrate");
        if (!triggerCelebrated) playSound(free ? "tigerScatter" : "tigerBonus", soundEnabled);
      } else {
        const tier = goldenTigerWinTier(result.payout, bet);
        setWinTier(tier);
        setPhase(tierPhase(tier));
        const duration = tier === "small" ? 320 : tier === "nice" ? 620 : tier === "big" ? 980 : 1_350;
        const animatedDuration = result.payout > 0 && !reducedMotion && tier !== "none" ? duration : 0;
        setWinDuration(animatedDuration);
        setWin(result.payout);
        if (animatedDuration > 0) await wait(animatedDuration);
        playSound(
          tier === "big" || tier === "mega" ? "bigWin" : result.payout > 0 ? "win" : "lose",
          soundEnabled,
        );
        if (tier === "big" || tier === "mega") await wait(turbo ? 220 : tier === "mega" ? 880 : 620);
        setTigerReaction("idle");
        setPhase(free ? "bonusPlaying" : "idle");
      }

      busyRef.current = false;
      return result;
    },
    [bet, reducedMotion, soundEnabled, turbo],
  );

  const runBonus = useCallback(
    async (initial: number) => {
      if (initial <= 0 || bonusRef.current) return;
      bonusRef.current = true;
      setBonusActive(true);
      setBonusWin(0);
      setBonusSpins(initial);
      setPhase("bonusIntro");
      setTigerReaction("celebrate");
      setBonusOverlay({
        title: "FREE SPINS",
        value: String(initial),
        caption: "A sorte dourada começou",
        tone: "bonus",
      });
      playSound("tigerBonus", soundEnabled);
      await wait(turbo ? 420 : 900);
      setBonusOverlay(null);
      setTigerReaction("idle");

      let left = initial;
      let total = 0;
      let retriggers = 0;
      while (left > 0) {
        setPhase("bonusPlaying");
        setBonusSpins(left);
        const result = await spinRound(true);
        if (!result) break;
        total += result.payout;
        setBonusWin(total);
        left -= 1;

        if (result.bonusAward > 0 && retriggers < GOLDEN_TIGER_MAX_RETRIGGERS) {
          retriggers += 1;
          left += result.bonusAward;
          setPhase("bonusRetrigger");
          setTigerReaction("celebrate");
          setBonusOverlay({
            title: "RETRIGGER",
            value: `+${result.bonusAward}`,
            caption: `Extensão ${retriggers}/${GOLDEN_TIGER_MAX_RETRIGGERS}`,
            tone: "retrigger",
          });
          playSound("tigerRetrigger", soundEnabled);
          await wait(turbo ? 360 : 760);
          setBonusOverlay(null);
          setTigerReaction("idle");
        }

        setBonusSpins(left);
        await wait(turbo ? 70 : 170);
      }

      setPhase("bonusOutro");
      setTigerReaction("notice");
      setBonusOverlay({
        title: "BÔNUS CONCLUÍDO",
        value: formatCoins(total),
        caption: "Ganho total nos Free Spins",
        tone: "outro",
      });
      playSound("cash", soundEnabled);
      await wait(turbo ? 480 : 980);
      setBonusOverlay(null);
      setBonusSpins(0);
      setBonusActive(false);
      setTigerReaction("idle");
      setPhase("idle");
      bonusRef.current = false;
    },
    [soundEnabled, spinRound, turbo],
  );

  const spin = useCallback(async () => {
    if (busyRef.current || bonusRef.current) return false;
    const result = await spinRound(false);
    if (!result) return false;
    if (result.bonusAward > 0) await runBonus(result.bonusAward);
    return true;
  }, [runBonus, spinRound]);

  const startAuto = useCallback(async () => {
    if (busyRef.current || bonusRef.current || autoLeft > 0) return;
    autoStopRef.current = false;
    for (let left = 10; left > 0; left -= 1) {
      if (autoStopRef.current) break;
      setAutoLeft(left);
      const played = await spin();
      if (!played) break;
      await wait(turbo ? 110 : 280);
    }
    setAutoLeft(0);
  }, [autoLeft, spin, turbo]);

  const changeBet = (direction: -1 | 1) => {
    if (spinning || bonusActive || autoLeft > 0) return;
    const current = Math.max(0, BET_STEPS.findIndex((value) => value === bet));
    const next = Math.max(0, Math.min(BET_STEPS.length - 1, current + direction));
    const value = BET_STEPS[next];
    if (value !== undefined) setBet(value);
  };

  const setMaxBet = () => {
    const affordable = [...BET_STEPS].reverse().find((value) => value <= balance);
    if (affordable !== undefined && !spinning && !bonusActive && autoLeft === 0) setBet(affordable);
  };

  const insufficient = bet > balance;
  const targetX =
    flyingCardColumn === null ? 50 : 6.7 + (flyingCardColumn + 0.5) * (85.1 / 5);
  const tigerStyle = { "--gt-target-x": `${targetX}%` } as CSSProperties;
  const scatterOrderByIndex = useMemo(() => {
    const ordered = [...scatters].sort((a, b) => a - b);
    return new Map(ordered.map((index, order) => [index, order]));
  }, [scatters]);
  const currentTierLabel = tierLabel(winTier);
  const statusText =
    anticipation === 2
      ? "2 CARTINHAS... FALTA SÓ 1!"
      : anticipation === 1
        ? "1 CARTINHA... OLHOS NA GRADE"
        : bonusActive
          ? `FREE SPINS ${bonusSpins}`
          : phase === "bonusTrigger"
            ? "BÔNUS DOURADO!"
            : currentTierLabel ?? "3 CARTINHAS ATIVAM FREE SPINS!";

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black sm:px-3 sm:py-2">
      <div
        className={cn(
          "gt-ref-machine relative mx-auto aspect-[940/1672] w-full max-w-[430px] overflow-hidden bg-[#240003] shadow-[0_0_90px_rgba(0,0,0,.96)] sm:rounded-[22px]",
          bonusActive && "gt-ref-bonus-mode",
        )}
        data-phase={phase}
        data-tiger={tigerReaction}
      >
        {src ? (
          <img
            src={src}
            alt="Golden Tiger"
            draggable={false}
            className="absolute inset-0 size-full select-none object-fill"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[#260003] p-8 text-center font-bold text-yellow-100">
            {failed ? "Falha ao carregar a arte do Golden Tiger." : "Carregando Golden Tiger…"}
          </div>
        )}
        <div className="gt-ref-machine__ambient" aria-hidden />
        <div className="gt-ref-tiger-stage" style={tigerStyle} aria-hidden>
          <span className="gt-ref-tiger-live-eyes" />
          <span className="gt-ref-tiger-live-paw" />
          {flyingCardColumn !== null && (
            <span className="gt-ref-flying-card">
              <span />
            </span>
          )}
        </div>

        <Link
          to="/"
          aria-label="Voltar ao lobby"
          className="absolute left-[1.2%] top-[.8%] z-50 grid size-[8.8%] place-items-center rounded-full bg-black/10 text-transparent"
        >
          <ArrowLeft className="size-4 opacity-0" />
        </Link>
        <button
          type="button"
          onClick={() => arcadeActions.toggleSound()}
          aria-label={soundEnabled ? "Desativar som" : "Ativar som"}
          className="absolute right-[9.3%] top-[.8%] z-50 size-[8.8%] rounded-full bg-transparent"
        >
          {soundEnabled ? (
            <Volume2 className="mx-auto size-4 opacity-0" />
          ) : (
            <VolumeX className="mx-auto size-4 opacity-0" />
          )}
        </button>

        {src && (
          <div className="gt-ref-grid absolute left-[6.7%] top-[32.53%] z-20 grid h-[31.4%] w-[85.1%] grid-cols-5 grid-rows-3 overflow-hidden">
            {grid.map((symbol, index) => {
              const column = index % 5;
              const isRolling = spinning && column >= stoppedColumns;
              const isLanding = spinning && landingColumn === column;
              const isAnticipating = spinning && anticipation > 0 && column >= stoppedColumns;
              const scatterOrder = scatterOrderByIndex.get(index) ?? -1;
              const tileStyle =
                scatterOrder >= 0
                  ? ({ "--gt-scatter-order": scatterOrder } as CSSProperties)
                  : undefined;
              return (
                <div
                  key={index}
                  style={tileStyle}
                  className={cn(
                    "relative overflow-hidden border-[1px] border-[#f8bd35]/45 bg-[#4b0710]",
                    isRolling && "gt-ref-spinning",
                    isLanding && "gt-ref-land",
                    isAnticipating && "gt-ref-anticipate",
                    scatters.has(index) && "gt-ref-scatter",
                    !spinning && winning.has(index) && "gt-ref-win",
                  )}
                >
                  <ReferenceSymbol id={symbol} src={src} />
                </div>
              );
            })}
          </div>
        )}

        <div
          className="absolute left-[18%] top-[63.7%] z-35 flex h-[7.2%] w-[69%] items-center justify-center rounded-[28px] border-2 border-[#ffc52b] bg-[linear-gradient(180deg,rgba(122,0,7,.97),rgba(58,0,4,.98))] px-4 text-center shadow-[0_0_22px_rgba(255,67,0,.45)]"
          aria-live="polite"
        >
          <div>
            <p className="font-serif text-[clamp(.72rem,4vw,1.15rem)] font-black uppercase leading-tight text-[#ffe475] drop-shadow-[0_2px_0_#7b1500]">
              {statusText}
            </p>
            {bonusActive && (
              <p className="mt-1 text-[9px] font-black text-emerald-200">
                GANHO NO BÔNUS {formatCoins(bonusWin)}
              </p>
            )}
          </div>
        </div>

        <NumberPatch className="left-[5%] top-[79.1%] h-[3.4%] w-[25.5%] text-[clamp(.7rem,4vw,1.08rem)] tabular-nums">
          {formatCoins(balance)}
        </NumberPatch>
        <NumberPatch className="left-[34.4%] top-[77.9%] h-[4.4%] w-[31.2%] text-[clamp(1rem,6vw,1.65rem)] tabular-nums text-[#ffd73f]">
          <AnimatedWinCounter value={win} duration={winDuration} />
        </NumberPatch>
        <NumberPatch className="left-[75%] top-[79.1%] h-[3.4%] w-[16.6%] text-[clamp(.7rem,4vw,1.08rem)] tabular-nums">
          {formatCoins(bet)}
        </NumberPatch>

        <button
          type="button"
          onClick={() => changeBet(-1)}
          disabled={spinning || bonusActive || autoLeft > 0}
          aria-label="Diminuir aposta"
          className="absolute left-[69%] top-[78.45%] z-50 size-[6.3%] rounded-full disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={() => changeBet(1)}
          disabled={spinning || bonusActive || autoLeft > 0}
          aria-label="Aumentar aposta"
          className="absolute right-[2.3%] top-[78.45%] z-50 size-[6.3%] rounded-full disabled:cursor-not-allowed"
        />

        <button
          type="button"
          onClick={() => setTurbo((value) => !value)}
          aria-pressed={turbo}
          aria-label="Alternar turbo"
          className={cn(
            "absolute left-[4.2%] top-[86.1%] z-50 h-[8.3%] w-[17.7%] rounded-[28px]",
            turbo && "ring-2 ring-yellow-200 shadow-[0_0_25px_#ffb000]",
          )}
        />
        {autoLeft > 0 ? (
          <button
            type="button"
            onClick={() => {
              autoStopRef.current = true;
            }}
            aria-label="Parar auto play"
            className="absolute left-[22.4%] top-[86.1%] z-50 h-[8.3%] w-[17.8%] rounded-[28px]"
          >
            <span className="absolute right-0 top-0 rounded-full bg-emerald-500 px-1.5 text-[9px] font-black text-white">
              {autoLeft}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startAuto()}
            disabled={spinning || bonusActive || insufficient || !src}
            aria-label="Auto play"
            className="absolute left-[22.4%] top-[86.1%] z-50 h-[8.3%] w-[17.8%] rounded-[28px] disabled:opacity-40"
          />
        )}
        <button
          type="button"
          onClick={setMaxBet}
          disabled={spinning || bonusActive || autoLeft > 0}
          aria-label="Aposta máxima"
          className="absolute right-[4.3%] top-[86.1%] z-50 h-[8.3%] w-[25%] rounded-[28px] disabled:opacity-40"
        />

        <button
          type="button"
          onClick={() => void spin()}
          disabled={spinning || bonusActive || autoLeft > 0 || insufficient || !src}
          aria-label="Girar Golden Tiger"
          className={cn(
            "gt-ref-spin-button absolute left-[34%] top-[82.7%] z-50 size-[29.5%] rounded-full disabled:cursor-not-allowed disabled:opacity-45",
            spinning && "scale-95",
          )}
        />

        {(winTier === "big" || winTier === "mega") && win > 0 && phase === "bigWin" && (
          <div className={cn("gt-ref-win-callout", `gt-ref-win-callout--${winTier}`)} aria-live="polite">
            <span>{tierLabel(winTier)}</span>
            <strong><AnimatedWinCounter value={win} duration={winDuration} /></strong>
          </div>
        )}

        {bonusOverlay && (
          <div
            className={cn("gt-ref-bonus-overlay", `gt-ref-bonus-overlay--${bonusOverlay.tone}`)}
            role="status"
            aria-live="polite"
          >
            <div className="gt-ref-bonus-card">
              <p>{bonusOverlay.title}</p>
              {bonusOverlay.value && <strong>{bonusOverlay.value}</strong>}
              {bonusOverlay.caption && <span>{bonusOverlay.caption}</span>}
            </div>
          </div>
        )}

        {insufficient && !bonusActive && (
          <div className="absolute inset-x-[12%] bottom-[.8%] z-[70] rounded-xl border border-red-200/80 bg-red-950/95 px-3 py-2 text-center text-[10px] font-bold text-red-50">
            Saldo fictício insuficiente — recarregue moedas grátis no lobby.
          </div>
        )}
        <div className="absolute inset-x-0 bottom-[.15%] z-20 text-center text-[7px] font-black tracking-[.18em] text-yellow-100/75">
          MOEDAS FICTÍCIAS · SEM VALOR REAL
        </div>
      </div>
    </main>
  );
}
