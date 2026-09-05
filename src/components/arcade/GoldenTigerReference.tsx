import { Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles, Volume2, VolumeX } from "lucide-react";

import { AnimatedWinCounter } from "./AnimatedWinCounter";
import {
  memo,
  useCallback,
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
  createGoldenFortunePurchaseLock,
  goldenFortuneAvailability,
} from "@/lib/arcade/goldenTigerFeatureBuy";
import {
  GOLDEN_TIGER_FEATURE_BUY_INITIAL_SPINS,
  GOLDEN_TIGER_MAX_RETRIGGERS,
  evaluateGoldenTiger,
  goldenTigerFeatureBuyCost,
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
  | "featureBuy"
  | "bonusTrigger"
  | "bonusIntro"
  | "bonusPlaying"
  | "bonusRetrigger"
  | "bonusOutro";
type TigerReaction =
  | "idle"
  | "watch"
  | "notice"
  | "excited"
  | "charge"
  | "throw"
  | "celebrate"
  | "bigWin"
  | "bonus"
  | "retrigger"
  | "miss";
type BonusOverlay = {
  title: string;
  value?: string;
  caption?: string;
  tone: "bonus" | "retrigger" | "outro";
} | null;
type PurchasedBonusContext = { cost: number } | null;

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

const TigerStage = memo(function TigerStage({ flyingCardColumn }: { flyingCardColumn: number | null }) {
  const targetX = flyingCardColumn === null ? 50 : 6.7 + (flyingCardColumn + 0.5) * (85.1 / 5);
  const tigerStyle = { "--gt-target-x": `${targetX}%` } as CSSProperties;

  return (
    <div className="gt-ref-tiger-stage" style={tigerStyle} aria-hidden>
      <span className="gt-ref-tiger-rim" />
      <span className="gt-ref-tiger-live-eyes" />
      <span className="gt-ref-tiger-live-paw" />
      <span className="gt-ref-tiger-foreground" />
      {flyingCardColumn !== null && (
        <span className="gt-ref-flying-card">
          <span />
        </span>
      )}
    </div>
  );
});

const GoldenFortuneButton = memo(function GoldenFortuneButton({
  disabled,
  onOpen,
}: {
  disabled: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      aria-label="Abrir Golden Fortune Bonus Buy"
      className="gt-ref-feature-button absolute left-[4.6%] top-[71.2%] z-50 flex h-[5.8%] w-[28%] items-center justify-center gap-1.5 rounded-[18px] disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Sparkles className="size-3.5" aria-hidden />
      <span>BÔNUS</span>
    </button>
  );
});

const GoldenFortuneTrigger = memo(function GoldenFortuneTrigger() {
  return (
    <div className="gt-ref-feature-trigger" aria-hidden>
      <div className="gt-ref-feature-card gt-ref-feature-card--one" />
      <div className="gt-ref-feature-card gt-ref-feature-card--two" />
      <div className="gt-ref-feature-card gt-ref-feature-card--three" />
      <div className="gt-ref-feature-bath" />
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
  return tier === "big" || tier === "mega"
    ? "bigWin"
    : tier === "small" || tier === "nice"
      ? "smallWin"
      : "evaluating";
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
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoRounds, setAutoRounds] = useState(10);
  const [bonusActive, setBonusActive] = useState(false);
  const [bonusSpins, setBonusSpins] = useState(0);
  const [bonusWin, setBonusWin] = useState(0);
  const [bonusOverlay, setBonusOverlay] = useState<BonusOverlay>(null);
  const [phase, setPhase] = useState<PresentationPhase>("idle");
  const [tigerReaction, setTigerReaction] = useState<TigerReaction>("idle");
  const [flyingCardColumn, setFlyingCardColumn] = useState<number | null>(null);
  const [winTier, setWinTier] = useState<GoldenTigerWinTier>("none");
  const [featureBuyOpen, setFeatureBuyOpen] = useState(false);
  const [featureBuyRunning, setFeatureBuyRunning] = useState(false);
  const [featureBuyStage, setFeatureBuyStage] = useState(0);
  const [featureBuyError, setFeatureBuyError] = useState<string | null>(null);

  const busyRef = useRef(false);
  const stoppedRef = useRef(5);
  const autoStopRef = useRef(false);
  const bonusRef = useRef(false);
  const rollingRef = useRef<number | null>(null);
  const presentationRngRef = useRef<() => number>(createPresentationRng());
  const featureBuyLockRef = useRef(createGoldenFortunePurchaseLock());

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
      setTigerReaction(free ? "bonus" : "idle");
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
            setTigerReaction(free ? "bonus" : "idle");
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
        setTigerReaction(free ? "bonus" : "idle");
      }

      if (result.bonusAward > 0) {
        setWinDuration(0);
        setWin(result.payout);
        setPhase("bonusTrigger");
        setTigerReaction(free ? "retrigger" : "celebrate");
        if (!triggerCelebrated) playSound(free ? "tigerScatter" : "tigerBonus", soundEnabled);
      } else {
        const tier = goldenTigerWinTier(result.payout, bet);
        setWinTier(tier);
        setPhase(tierPhase(tier));
        if (tier === "big" || tier === "mega") setTigerReaction("bigWin");
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
        setTigerReaction(free ? "bonus" : "idle");
        setPhase(free ? "bonusPlaying" : "idle");
      }

      busyRef.current = false;
      return result;
    },
    [bet, reducedMotion, soundEnabled, turbo],
  );

  const runBonus = useCallback(
    async (initial: number, purchased: PurchasedBonusContext = null) => {
      if (initial <= 0 || bonusRef.current) return;
      bonusRef.current = true;
      setBonusActive(true);
      setBonusWin(0);
      setBonusSpins(initial);
      setPhase("bonusIntro");
      setTigerReaction("bonus");
      setBonusOverlay({
        title: purchased ? "GOLDEN FORTUNE" : "RODADAS GRÁTIS",
        value: String(initial),
        caption: purchased ? "8 Free Spins ativados · START" : "A sorte dourada começou",
        tone: "bonus",
      });
      playSound(purchased ? "tigerFeatureStart" : "tigerBonus", soundEnabled);
      await wait(turbo ? 420 : 900);
      setBonusOverlay(null);

      let left = initial;
      let total = 0;
      let retriggers = 0;
      while (left > 0) {
        setPhase("bonusPlaying");
        setTigerReaction("bonus");
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
          setTigerReaction("retrigger");
          setBonusOverlay({
            title: "RETRIGGER",
            value: `+${result.bonusAward}`,
            caption: `Extensão ${retriggers}/${GOLDEN_TIGER_MAX_RETRIGGERS}`,
            tone: "retrigger",
          });
          playSound("tigerRetrigger", soundEnabled);
          await wait(turbo ? 360 : 760);
          setBonusOverlay(null);
          setTigerReaction("bonus");
        }

        setBonusSpins(left);
        await wait(turbo ? 70 : 170);
      }

      if (purchased) {
        arcadeActions.recordRound({
          slug: "golden-tiger",
          gameName: "Golden Tiger",
          bet: purchased.cost,
          payout: total,
          multiplier: purchased.cost > 0 ? total / purchased.cost : 0,
          note: `Compra de Bônus · Golden Fortune · Custo ${formatCoins(purchased.cost)} · Resultado ${formatCoins(total)}`,
        });
      }

      setPhase("bonusOutro");
      setTigerReaction(total >= bet * 15 ? "bigWin" : "excited");
      setBonusOverlay({
        title: "TOTAL DO BÔNUS",
        value: formatCoins(total),
        caption: purchased ? "Golden Fortune concluído" : "Ganho total nos Free Spins",
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
    [bet, soundEnabled, spinRound, turbo],
  );

  const spin = useCallback(async () => {
    if (busyRef.current || bonusRef.current || featureBuyOpen || featureBuyRunning) return false;
    const result = await spinRound(false);
    if (!result) return false;
    if (result.bonusAward > 0) await runBonus(result.bonusAward);
    return true;
  }, [featureBuyOpen, featureBuyRunning, runBonus, spinRound]);

  const startAuto = useCallback(async () => {
    if (busyRef.current || bonusRef.current || autoLeft > 0 || featureBuyOpen || featureBuyRunning) return;
    autoStopRef.current = false;
    setAutoOpen(false);
    for (let left = autoRounds; left > 0; left -= 1) {
      if (autoStopRef.current) break;
      setAutoLeft(left);
      const played = await spin();
      if (!played) break;
      await wait(turbo ? 110 : 280);
    }
    setAutoLeft(0);
  }, [autoLeft, autoRounds, featureBuyOpen, featureBuyRunning, spin, turbo]);

  const openFeatureBuy = useCallback(() => {
    const availability = goldenFortuneAvailability({
      balance,
      bet,
      spinning: spinning || busyRef.current,
      bonusActive: bonusActive || bonusRef.current,
      autoLeft,
      pending: featureBuyRunning || featureBuyLockRef.current.isLocked(),
    });
    if (!availability.allowed && availability.reason !== "insufficientBalance") return;
    setFeatureBuyError(
      availability.reason === "insufficientBalance"
        ? "Saldo fictício insuficiente para ativar o bônus."
        : null,
    );
    setFeatureBuyOpen(true);
    setPhase("featureBuy");
    setTigerReaction("watch");
    playSound("tigerFeatureOpen", soundEnabled);
  }, [autoLeft, balance, bet, bonusActive, featureBuyRunning, soundEnabled, spinning]);

  const closeFeatureBuy = useCallback(() => {
    if (featureBuyRunning) return;
    setFeatureBuyOpen(false);
    setFeatureBuyError(null);
    setPhase("idle");
    setTigerReaction("idle");
  }, [featureBuyRunning]);

  const confirmFeatureBuy = useCallback(async () => {
    if (!featureBuyLockRef.current.acquire()) return;
    const availability = goldenFortuneAvailability({
      balance: arcadeActions.getBalance(),
      bet,
      spinning: spinning || busyRef.current,
      bonusActive: bonusActive || bonusRef.current,
      autoLeft,
      pending: featureBuyRunning,
    });
    if (!availability.allowed || !arcadeActions.debitCoins(availability.cost)) {
      setFeatureBuyError("Saldo fictício insuficiente ou bônus indisponível neste momento.");
      featureBuyLockRef.current.release();
      return;
    }

    setFeatureBuyError(null);
    setFeatureBuyOpen(false);
    setFeatureBuyRunning(true);
    setFeatureBuyStage(1);
    setPhase("featureBuy");
    setTigerReaction("notice");
    playSound("tigerCardAppear", soundEnabled);

    await wait(reducedMotion ? 80 : turbo ? 120 : 260);
    setFeatureBuyStage(2);
    setTigerReaction("excited");
    playSound("tigerCardAppear", soundEnabled);

    await wait(reducedMotion ? 80 : turbo ? 120 : 260);
    setFeatureBuyStage(3);
    setTigerReaction("charge");
    playSound("anticipation", soundEnabled);

    await wait(reducedMotion ? 100 : turbo ? 180 : 420);
    setFeatureBuyStage(4);
    setTigerReaction("throw");
    playSound("tigerThrow", soundEnabled);

    await wait(reducedMotion ? 100 : turbo ? 240 : 560);
    setFeatureBuyStage(5);
    setTigerReaction("celebrate");
    playSound("tigerImpact", soundEnabled);

    await wait(reducedMotion ? 100 : turbo ? 220 : 460);
    setFeatureBuyStage(6);
    playSound("tigerFeatureStart", soundEnabled);
    await wait(reducedMotion ? 80 : turbo ? 180 : 380);

    try {
      setFeatureBuyStage(0);
      setFeatureBuyRunning(false);
      await runBonus(GOLDEN_TIGER_FEATURE_BUY_INITIAL_SPINS, { cost: availability.cost });
    } finally {
      setFeatureBuyStage(0);
      setFeatureBuyRunning(false);
      featureBuyLockRef.current.release();
    }
  }, [
    autoLeft,
    bet,
    bonusActive,
    featureBuyRunning,
    reducedMotion,
    runBonus,
    soundEnabled,
    spinning,
    turbo,
  ]);

  const changeBet = (direction: -1 | 1) => {
    if (spinning || bonusActive || autoLeft > 0 || featureBuyOpen || featureBuyRunning) return;
    const current = Math.max(0, BET_STEPS.findIndex((value) => value === bet));
    const next = Math.max(0, Math.min(BET_STEPS.length - 1, current + direction));
    const value = BET_STEPS[next];
    if (value !== undefined) setBet(value);
  };

  const setMaxBet = () => {
    const affordable = [...BET_STEPS].reverse().find((value) => value <= balance);
    if (
      affordable !== undefined &&
      !spinning &&
      !bonusActive &&
      autoLeft === 0 &&
      !featureBuyOpen &&
      !featureBuyRunning
    ) {
      setBet(affordable);
    }
  };

  const insufficient = bet > balance;
  const featureBuyCost = goldenTigerFeatureBuyCost(bet);
  const featureBuyInsufficient = featureBuyCost > balance;
  const featureBuyBlocked =
    spinning || bonusActive || autoLeft > 0 || featureBuyRunning || busyRef.current || bonusRef.current;
  const scatterOrderByIndex = useMemo(() => {
    const ordered = [...scatters].sort((a, b) => a - b);
    return new Map(ordered.map((index, order) => [index, order]));
  }, [scatters]);
  const currentTierLabel = tierLabel(winTier);
  const hasWinningSymbols = !spinning && winning.size > 0;
  const statusText =
    anticipation === 2
      ? "2 CARTINHAS... FALTA SÓ 1!"
      : anticipation === 1
        ? "1 CARTINHA... OLHOS NA GRADE"
        : bonusActive
          ? `RODADAS GRÁTIS ${bonusSpins}`
          : featureBuyRunning
            ? "GOLDEN FORTUNE"
            : phase === "bonusTrigger"
              ? "BÔNUS DOURADO!"
              : currentTierLabel ?? "3 CARTINHAS ATIVAM RODADAS GRÁTIS!";

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black sm:px-3 sm:py-2">
        <div
          className={cn(
            "gt-ref-machine relative mx-auto aspect-[940/1672] w-full max-w-[430px] overflow-hidden bg-[#240003] shadow-[0_0_90px_rgba(0,0,0,.96)] sm:rounded-[22px]",
            bonusActive && "gt-ref-bonus-mode",
            featureBuyRunning && "gt-ref-feature-running",
            hasWinningSymbols && "gt-ref-machine--has-win",
        )}
        data-phase={phase}
        data-tiger={tigerReaction}
        data-feature-stage={featureBuyStage}
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
        <div className="gt-ref-branding" aria-label="Golden Tiger">
          <span>NEON FORTUNE</span>
          <strong>GOLDEN<br />TIGER</strong>
        </div>
        <div className="gt-ref-jackpots" aria-label="Jackpots em moedas fictícias">
          <p><span>GRAND</span><b>1.250.000</b></p>
          <p><span>MAJOR</span><b>125.000</b></p>
          <p><span>MINOR</span><b>25.000</b></p>
          <p><span>MINI</span><b>5.000</b></p>
          <small>MOEDAS</small>
        </div>
        <TigerStage flyingCardColumn={flyingCardColumn} />

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
          aria-pressed={soundEnabled}
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
                    "gt-ref-reel-cell relative overflow-hidden border-[1px] border-[#f8bd35]/45 bg-[#4b0710]",
                    isRolling && "gt-ref-spinning",
                    isLanding && "gt-ref-land",
                    isAnticipating && "gt-ref-anticipate",
                    scatters.has(index) && "gt-ref-scatter",
                    !spinning && winning.has(index) && "gt-ref-win",
                    hasWinningSymbols && !winning.has(index) && "gt-ref-cell--dim",
                    ["ingot", "jade", "fortuneBag", "wild"].includes(symbol) && "gt-ref-cell--premium-symbol",
                  )}
                >
                  <ReferenceSymbol id={symbol} src={src} />
                </div>
              );
            })}
          </div>
        )}

        {featureBuyRunning && <GoldenFortuneTrigger />}

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

        <GoldenFortuneButton disabled={featureBuyBlocked || !src} onOpen={openFeatureBuy} />

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
          disabled={spinning || bonusActive || autoLeft > 0 || featureBuyOpen || featureBuyRunning}
          aria-label="Diminuir aposta"
          className="absolute left-[69%] top-[78.45%] z-50 size-[6.3%] rounded-full disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={() => changeBet(1)}
          disabled={spinning || bonusActive || autoLeft > 0 || featureBuyOpen || featureBuyRunning}
          aria-label="Aumentar aposta"
          className="absolute right-[2.3%] top-[78.45%] z-50 size-[6.3%] rounded-full disabled:cursor-not-allowed"
        />

        <button
          type="button"
          onClick={() => setTurbo((value) => !value)}
          disabled={spinning || bonusActive || autoLeft > 0 || featureBuyOpen || featureBuyRunning}
          aria-pressed={turbo}
          aria-label="Alternar turbo"
          className={cn(
            "absolute left-[4.2%] top-[86.1%] z-50 h-[8.3%] w-[17.7%] rounded-[28px] disabled:cursor-not-allowed disabled:opacity-45",
            turbo && "ring-2 ring-yellow-200 bg-amber-300/20 shadow-[0_0_25px_#ffb000]",
          )}
        >
          <span className={cn("absolute inset-x-0 bottom-1 text-center text-[8px] font-black tracking-wide", turbo ? "text-yellow-100" : "text-yellow-100/70")}>{turbo ? "TURBO ATIVO" : "TURBO"}</span>
        </button>
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
            onClick={() => setAutoOpen(true)}
            disabled={spinning || bonusActive || insufficient || !src || featureBuyOpen || featureBuyRunning}
            aria-label={`Configurar auto play: ${autoRounds} rodadas`}
            className="absolute left-[22.4%] top-[86.1%] z-50 h-[8.3%] w-[17.8%] rounded-[28px] disabled:opacity-40"
          />
        )}
        {autoOpen && (
          <div className="absolute inset-0 z-[80] grid place-items-end bg-black/60 px-5 pb-[18%]" role="dialog" aria-modal="true" aria-label="Configurar auto play">
            <div className="w-full rounded-2xl border border-yellow-300/70 bg-[#3a0508] p-4 text-center shadow-[0_12px_40px_rgba(0,0,0,.75)]">
              <p className="text-xs font-black tracking-[.18em] text-yellow-200">AUTO PLAY</p>
              <p className="mt-1 text-[11px] text-yellow-50/80">{formatCoins(bet)} MOEDAS por rodada</p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[10, 25, 50, 100].map((rounds) => <button key={rounds} type="button" onClick={() => setAutoRounds(rounds)} className={cn("min-h-11 rounded-lg border text-xs font-black", autoRounds === rounds ? "border-yellow-200 bg-yellow-400 text-[#4a0800]" : "border-yellow-200/35 bg-black/25 text-yellow-100")}>{rounds}</button>)}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setAutoOpen(false)} className="min-h-11 rounded-lg border border-yellow-200/35 text-xs font-black text-yellow-100">CANCELAR</button><button type="button" onClick={() => void startAuto()} className="min-h-11 rounded-lg bg-yellow-400 text-xs font-black text-[#4a0800]">INICIAR {autoRounds}</button></div>
              <small className="mt-2 block text-[9px] font-bold text-yellow-50/65">MOEDAS FICTÍCIAS · SEM VALOR REAL</small>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={setMaxBet}
          disabled={spinning || bonusActive || autoLeft > 0 || featureBuyOpen || featureBuyRunning}
          aria-label="Aposta máxima"
          className="absolute right-[4.3%] top-[86.1%] z-50 h-[8.3%] w-[25%] rounded-[28px] disabled:opacity-40"
        />

        <button
          type="button"
          onClick={() => void spin()}
          disabled={spinning || bonusActive || autoLeft > 0 || insufficient || !src || featureBuyOpen || featureBuyRunning}
          aria-label="Girar Golden Tiger"
          className={cn(
            "gt-ref-spin-button absolute left-[34%] top-[82.7%] z-50 size-[29.5%] rounded-full disabled:cursor-not-allowed disabled:opacity-45",
            spinning && "scale-95",
          )}
          />

        {(winTier === "big" || winTier === "mega") && win > 0 && phase === "bigWin" && (
          <div
            className={cn("gt-ref-win-callout", `gt-ref-win-callout--${winTier}`)}
            aria-live="polite"
          >
            <span>{tierLabel(winTier)}</span>
            <strong>
              <AnimatedWinCounter value={win} duration={winDuration} />
            </strong>
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

        {featureBuyOpen && (
          <div
            className="gt-ref-feature-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="golden-fortune-title"
          >
            <div className="gt-ref-feature-modal__card">
              <span className="gt-ref-feature-modal__kicker">FEATURE BUY · NEON FORTUNE</span>
              <h2 id="golden-fortune-title">GOLDEN FORTUNE</h2>
              <strong>{GOLDEN_TIGER_FEATURE_BUY_INITIAL_SPINS} RODADAS GRÁTIS</strong>
              <p>
                Equivale à entrada normal de 3 cartinhas. Inclui retriggers e a mesma matemática dos
                rodadas grátis naturais.
              </p>
              <div className="gt-ref-feature-modal__stats">
                <div>
                  <span>APOSTA ATUAL</span>
                  <b>{formatCoins(bet)}</b>
                </div>
                <div>
                  <span>CUSTO</span>
                  <b>{formatCoins(featureBuyCost)} MOEDAS</b>
                </div>
              </div>
              <small>MOEDAS FICTÍCIAS · SEM VALOR REAL</small>
              {featureBuyError && <em role="alert">{featureBuyError}</em>}
              <div className="gt-ref-feature-modal__actions">
                <button type="button" onClick={closeFeatureBuy}>
                  CANCELAR
                </button>
                <button
                  type="button"
                  onClick={() => void confirmFeatureBuy()}
                  disabled={featureBuyInsufficient || featureBuyRunning}
                >
                  ATIVAR
                </button>
              </div>
            </div>
          </div>
        )}

        {insufficient && !bonusActive && !featureBuyOpen && (
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