import { Link } from "@tanstack/react-router";
import { ArrowLeft, Gift, Sparkles, Volume2, VolumeX, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AnimatedWinCounter } from "./AnimatedWinCounter";
import { GoldenTigerScene25D, type GoldenTigerLightingMode } from "./golden-tiger/GoldenTigerScene25D";
import { GoldenTigerSymbol } from "./golden-tiger/GoldenTigerSymbols";
import { GoldenTigerTigerStage, type TigerReactionState } from "./golden-tiger/GoldenTigerTigerStage";
import { GoldenTigerWinStage } from "./golden-tiger/GoldenTigerWinStage";
import { formatCoins } from "@/lib/arcade/format";
import {
  resolveGoldenTigerBasePaylines,
  resolveGoldenTigerFeaturePaylines,
  type GoldenTigerPaylinePresentation,
} from "@/lib/arcade/goldenTigerPaylinePresentation";
import {
  GOLDEN_TIGER_BONUS_BUY_MULTIPLIER,
  runPurchasedFortuneFeature,
} from "@/lib/arcade/goldenTigerBonusBuy";
import {
  disposeGoldenTigerAudio,
  playGoldenTigerAudio,
  scheduleGoldenTigerWinCounterAudio,
  type GoldenTigerAudioEvent,
} from "@/lib/arcade/goldenTigerAudio";
import { GoldenTigerClock } from "@/lib/arcade/goldenTigerClock";
import { disposeGoldenTigerSampleEngine } from "@/lib/arcade/goldenTigerSampleEngine";
import {
  goldenTigerFeatureCellStaggerMs,
  goldenTigerFeatureRollingOrder,
} from "@/lib/arcade/goldenTigerFeatureMotion";
import {
  FORTUNE_FEATURE_FULL_GRID_MULTIPLIER,
  rollFortuneFeatureTrigger,
  runFortuneFeature,
  type FortuneFeatureCell,
  type FortuneFeatureResult,
} from "@/lib/arcade/goldenTigerFortuneFeature";
import {
  GOLDEN_TIGER_FULL_GRID_MULTIPLIER,
  evaluateGoldenTiger,
  goldenTigerWinTier,
  makeGoldenTigerGrid,
  type GoldenTigerSymbolId,
  type GoldenTigerWinTier,
} from "@/lib/arcade/goldenTigerMath";
import {
  goldenTigerAnticipationMs,
  goldenTigerBrakeEase,
  goldenTigerReelBlurPx,
  goldenTigerReelBrakeMs,
  goldenTigerReelLandPauseMs,
  goldenTigerReelOvershootPx,
  goldenTigerReelReboundMs,
  goldenTigerReelTensionMs,
  goldenTigerReelTensionPx,
  goldenTigerReboundEase,
  goldenTigerSpinLaunchMs,
} from "@/lib/arcade/goldenTigerMotion";
import { goldenTigerSettleHoldMs, goldenTigerWinTimeline, type GoldenTigerWinBeat } from "@/lib/arcade/goldenTigerWinTimeline";
import { setAmbienceEnergy, setGameAmbience } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";
import "./GoldenTigerCommercial.css";

const BETS = [10, 20, 50, 100, 200, 500, 1_000] as const;
const INITIAL_GRID: GoldenTigerSymbolId[] = ["fortuneBag", "ingot", "jade", "orange", "wild", "firecracker", "lion", "lantern", "fortuneBag"];
const REEL_STRIP: readonly GoldenTigerSymbolId[] = ["orange", "jade", "firecracker", "fortuneBag", "ingot", "lantern", "lion", "wild"];
const EMPTY_FEATURE_GRID: FortuneFeatureCell[] = Array.from({ length: 9 }, () => null);

const SYMBOL_LABEL: Record<GoldenTigerSymbolId, string> = {
  wild: "WILD",
  lion: "TIGRE",
  ingot: "LINGOTE",
  fortuneBag: "BOLSA",
  firecracker: "FOGOS",
  jade: "JADE",
  lantern: "LANTERNA",
  orange: "LARANJA",
};

type Phase =
  | "idle"
  | "base-spin"
  | "reveal"
  | "bonus-intro"
  | "feature-intro"
  | "feature-spin"
  | "feature-lock"
  | "feature-miss"
  | "feature-outro"
  | "return"
  | "win"
  | "full-grid";

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function reelFinalSymbols(
  grid: readonly GoldenTigerSymbolId[],
  column: number,
): [GoldenTigerSymbolId, GoldenTigerSymbolId, GoldenTigerSymbolId] {
  return [grid[column] ?? "orange", grid[column + 3] ?? "jade", grid[column + 6] ?? "ingot"];
}

type ReelMotionStage = "tension" | "accelerate" | "cruise" | "brake" | "rebound" | "landed";

function ReelOverlay({
  column,
  turbo,
  braking,
  finalSymbols,
}: {
  column: number;
  turbo: boolean;
  braking: boolean;
  finalSymbols: readonly [GoldenTigerSymbolId, GoldenTigerSymbolId, GoldenTigerSymbolId];
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const brakingRef = useRef(braking);
  const symbols: GoldenTigerSymbolId[] = [
    ...REEL_STRIP,
    ...REEL_STRIP,
    ...REEL_STRIP,
    ...REEL_STRIP,
    ...REEL_STRIP,
    ...finalSymbols,
  ];

  useEffect(() => {
    brakingRef.current = braking;
  }, [braking]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const track = trackRef.current;
    if (!overlay || !track) return;

    let frameId = 0;
    let lastTime = performance.now();
    let stageStartedAt = lastTime;
    let offset = 0;
    let initialized = false;
    let stage: ReelMotionStage = "tension";
    let brakeStartOffset = 0;

    const tensionMs = goldenTigerReelTensionMs(turbo);
    const tensionPx = goldenTigerReelTensionPx(column);
    const accelerationMs = turbo ? 72 + column * 8 : 150 + column * 16;
    const totalBrakeMs = goldenTigerReelBrakeMs(column, turbo);
    const reboundMs = goldenTigerReelReboundMs(column, turbo);
    const brakeTravelMs = Math.max(32, totalBrakeMs - reboundMs);
    const overshootPx = goldenTigerReelOvershootPx(column);

    const renderTrack = (nextOffset: number, velocityPxPerMs: number) => {
      offset = nextOffset;
      track.style.transform = `translateY(${-nextOffset}px)`;
      const blur = reducedMotion() ? 0 : goldenTigerReelBlurPx(velocityPxPerMs);
      track.style.filter = blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : "none";
    };

    const draw = (time: number) => {
      const itemHeight = overlay.clientHeight / 3;
      if (itemHeight <= 0) {
        frameId = requestAnimationFrame(draw);
        return;
      }

      if (!initialized) {
        offset = itemHeight * REEL_STRIP.length;
        initialized = true;
        stageStartedAt = time;
        lastTime = time;
        renderTrack(offset, 0);
      }

      const delta = Math.min(34, Math.max(1, time - lastTime));
      const finalOffset = itemHeight * (symbols.length - 3);
      const overshootOffset = finalOffset + overshootPx;
      const cruiseVelocity = itemHeight / (turbo ? 40 : 64);

      if (reducedMotion()) {
        if (brakingRef.current) {
          renderTrack(finalOffset, 0);
          return;
        }
        renderTrack(offset, 0);
        lastTime = time;
        frameId = requestAnimationFrame(draw);
        return;
      }

      if (brakingRef.current && stage !== "brake" && stage !== "rebound" && stage !== "landed") {
        stage = "brake";
        stageStartedAt = time;
        brakeStartOffset = offset;
      }

      if (stage === "tension") {
        const progress = Math.min(1, (time - stageStartedAt) / tensionMs);
        const baseOffset = itemHeight * REEL_STRIP.length;
        const recoil = Math.sin(progress * Math.PI) * tensionPx;
        const nextOffset = baseOffset - recoil;
        renderTrack(nextOffset, Math.abs(nextOffset - offset) / delta);
        if (progress >= 1) {
          stage = "accelerate";
          stageStartedAt = time;
          renderTrack(baseOffset, 0);
        }
      } else if (stage === "accelerate") {
        const progress = Math.min(1, (time - stageStartedAt) / accelerationMs);
        const eased = 1 - (1 - progress) ** 2.8;
        const velocity = cruiseVelocity * (0.16 + eased * 0.84);
        let nextOffset = offset + velocity * delta;
        const wrapAt = itemHeight * REEL_STRIP.length * 3;
        if (nextOffset >= wrapAt) nextOffset -= itemHeight * REEL_STRIP.length;
        renderTrack(nextOffset, velocity);
        if (progress >= 1) {
          stage = "cruise";
          stageStartedAt = time;
        }
      } else if (stage === "cruise") {
        let nextOffset = offset + cruiseVelocity * delta;
        const wrapAt = itemHeight * REEL_STRIP.length * 3;
        if (nextOffset >= wrapAt) nextOffset -= itemHeight * REEL_STRIP.length;
        renderTrack(nextOffset, cruiseVelocity);
      } else if (stage === "brake") {
        const progress = Math.min(1, (time - stageStartedAt) / brakeTravelMs);
        const nextOffset = brakeStartOffset + (overshootOffset - brakeStartOffset) * goldenTigerBrakeEase(progress);
        renderTrack(nextOffset, Math.abs(nextOffset - offset) / delta);
        if (progress >= 1) {
          stage = "rebound";
          stageStartedAt = time;
          renderTrack(overshootOffset, 0);
        }
      } else if (stage === "rebound") {
        const progress = Math.min(1, (time - stageStartedAt) / reboundMs);
        const nextOffset = overshootOffset + (finalOffset - overshootOffset) * goldenTigerReboundEase(progress);
        renderTrack(nextOffset, Math.abs(nextOffset - offset) / delta);
        if (progress >= 1) {
          stage = "landed";
          renderTrack(finalOffset, 0);
          return;
        }
      } else {
        renderTrack(finalOffset, 0);
        return;
      }

      lastTime = time;
      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameId);
      track.style.filter = "none";
    };
  }, [column, turbo, finalSymbols[0], finalSymbols[1], finalSymbols[2], symbols.length]);

  return (
    <div
      ref={overlayRef}
      className={cn("gt-hw-reel-overlay", braking && "is-braking")}
      style={{ left: `${column * 33.333333}%` }}
      aria-hidden
    >
      <div
        ref={trackRef}
        className="gt-hw-reel-track"
        style={{
          height: `${(symbols.length / 3) * 100}%`,
          animation: "none",
          transform: "translateY(0)",
          filter: "none",
        }}
      >
        {symbols.map((symbol, index) => (
          <div
            className="gt-hw-reel-item"
            style={{ height: `${100 / symbols.length}%` }}
            key={`${column}-${index}`}
          >
            <GoldenTigerSymbol id={symbol} />
          </div>
        ))}
      </div>
      <span className="gt-hw-reel-shade" />
    </div>
  );
}

function FeatureCellMotion({ selectedSymbol, index }: { selectedSymbol: GoldenTigerSymbolId; index: number }) {
  const symbols: GoldenTigerSymbolId[] = [selectedSymbol, "wild", selectedSymbol];
  return (
    <div className="gt-hw-cell-motion" aria-hidden>
      <div>
        {symbols.map((symbol, item) => (
          <span key={`${index}-${item}-${symbol}`}>
            <GoldenTigerSymbol id={symbol} />
          </span>
        ))}
      </div>
    </div>
  );
}

export function GoldenTigerPremium() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const [bet, setBet] = useState<number>(20);
  const [grid, setGrid] = useState<GoldenTigerSymbolId[]>(INITIAL_GRID);
  const [featureCells, setFeatureCells] = useState<FortuneFeatureCell[]>(EMPTY_FEATURE_GRID);
  const [selectedSymbol, setSelectedSymbol] = useState<GoldenTigerSymbolId | null>(null);
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [activePayline, setActivePayline] = useState<GoldenTigerPaylinePresentation | null>(null);
  const [freshCells, setFreshCells] = useState<Set<number>>(() => new Set());
  const [rollingCells, setRollingCells] = useState<Set<number>>(() => new Set());
  const [featureAttempt, setFeatureAttempt] = useState(0);
  const [stoppedColumns, setStoppedColumns] = useState(3);
  const [brakingColumn, setBrakingColumn] = useState(-1);
  const [landingColumn, setLandingColumn] = useState(-1);
  const [anticipating, setAnticipating] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [featureActive, setFeatureActive] = useState(false);
  const [featurePurchased, setFeaturePurchased] = useState(false);
  const [win, setWin] = useState(0);
  const [winTier, setWinTier] = useState<GoldenTigerWinTier>("none");
  const [winBeat, setWinBeat] = useState<GoldenTigerWinBeat>(null);
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [autoRounds, setAutoRounds] = useState(10);
  const [autoOpen, setAutoOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);
  const busyRef = useRef(false);
  const autoStopRef = useRef(false);
  const clockRef = useRef<GoldenTigerClock | null>(null);

  const playTigerAudio = useCallback((event: GoldenTigerAudioEvent) => {
    playGoldenTigerAudio(event, soundEnabled, clockRef.current ?? undefined);
  }, [soundEnabled]);

  const bonusCost = bet * GOLDEN_TIGER_BONUS_BUY_MULTIPLIER;
  const isBusy = phase !== "idle";
  const lockedCount = featureCells.reduce((count, symbol) => count + (symbol === null ? 0 : 1), 0);
  const selectedLabel = selectedSymbol ? SYMBOL_LABEL[selectedSymbol] : "—";

  useEffect(() => {
    hydrateFromStorage();
    const clock = new GoldenTigerClock();
    clockRef.current = clock;
    return () => {
      autoStopRef.current = true;
      disposeGoldenTigerAudio();
      disposeGoldenTigerSampleEngine();
      clock.dispose();
      if (clockRef.current === clock) clockRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!soundEnabled) {
      disposeGoldenTigerAudio();
      disposeGoldenTigerSampleEngine();
    }
    setGameAmbience("tiger", soundEnabled);
    return () => setGameAmbience("tiger", false);
  }, [soundEnabled]);

  useEffect(() => {
    const energy =
      phase === "full-grid" ? 1.48 :
      phase === "win" ? 1.34 :
      featureActive ? 1.3 :
      phase === "base-spin" ? 0.96 : 0.76;
    setAmbienceEnergy(energy);
  }, [featureActive, phase]);

  const wait = useCallback((ms: number) => {
    const duration = reducedMotion() ? 24 : ms;
    return clockRef.current?.wait(duration) ?? Promise.resolve();
  }, []);

  const waitForFeatureStagger = useCallback((orderIndex: number) => {
    return clockRef.current?.wait(goldenTigerFeatureCellStaggerMs(orderIndex, turbo)) ?? Promise.resolve();
  }, [turbo]);

  const presentPaylines = useCallback(async (lines: readonly GoldenTigerPaylinePresentation[]) => {
    if (lines.length === 0) return;

    for (const line of lines) {
      if (!clockRef.current) return;
      setActivePayline(line);
      setWinning(new Set(line.cells));
      await wait(turbo ? 90 : 300);
    }

    setActivePayline(null);
  }, [turbo, wait]);

  const tigerReaction: TigerReactionState =
    phase === "full-grid" && winBeat ? (winBeat === "celebrate" ? "full" : winBeat === "impact" ? "reveal" : "tense") :
    phase === "win" && winBeat ? (winBeat === "celebrate" ? "win" : winBeat === "impact" ? "reveal" : "tense") :
    phase === "bonus-intro" || phase === "feature-intro" || phase === "feature-lock" || phase === "feature-outro" ? "feature" :
    anticipating || (featureActive && lockedCount >= 6) ? "tense" :
    phase === "reveal" ? "reveal" :
    phase === "base-spin" || phase === "feature-spin" ? "watch" :
    phase === "win" ? "win" : phase === "full-grid" ? "full" : "idle";

  const sceneLighting: GoldenTigerLightingMode =
    phase === "full-grid" ? "full" :
    phase === "win" ? "win" :
    featureActive ? "feature" :
    phase === "base-spin" ? "spin" : "idle";

  const animateFeature = useCallback(async (plan: FortuneFeatureResult, purchased = false) => {
    let visibleGrid: FortuneFeatureCell[] = [...EMPTY_FEATURE_GRID];
    setFeaturePurchased(purchased);
    setFeatureCells([...visibleGrid]);
    setSelectedSymbol(plan.selectedSymbol);
    setFeatureAttempt(0);
    setFreshCells(new Set());
    setWinning(new Set());
    setFeatureActive(true);

    if (purchased) {
      setPhase("bonus-intro");
      playTigerAudio({ type: "feature-open" });
      await wait(turbo ? 260 : 900);
    }

    setPhase("feature-intro");
    await wait(turbo ? 190 : 620);

    for (const step of plan.steps) {
      setFeatureAttempt(step.respin);
      const lockedBeforeSpin = visibleGrid.reduce((count, symbol) => count + (symbol === null ? 0 : 1), 0);
      const rollingOrder = goldenTigerFeatureRollingOrder(visibleGrid);
      setRollingCells(new Set(rollingOrder));
      setPhase("feature-spin");
      playTigerAudio({
        type: "feature-respin",
        attempt: step.respin,
        lockedCount: lockedBeforeSpin,
      });
      await wait(turbo ? 170 : 470);

      const staggeredGrid = [...visibleGrid];
      const staggeredFresh = new Set<number>();

      for (let orderIndex = 0; orderIndex < rollingOrder.length; orderIndex += 1) {
        const cellIndex = rollingOrder[orderIndex];
        if (cellIndex === undefined) continue;

        staggeredGrid[cellIndex] = step.grid[cellIndex] ?? null;
        if (step.addedIndices.includes(cellIndex)) staggeredFresh.add(cellIndex);

        setFeatureCells([...staggeredGrid]);
        setFreshCells(new Set(staggeredFresh));
        setRollingCells((current) => {
          const next = new Set(current);
          next.delete(cellIndex);
          return next;
        });

        if (step.addedIndices.includes(cellIndex)) {
          const lockedAtThisBeat = lockedBeforeSpin + staggeredFresh.size;
          playTigerAudio({
            type: "feature-lock",
            lockedCount: lockedAtThisBeat,
            addedWild: step.grid[cellIndex] === "wild",
            fullGrid: step.isFullGrid && lockedAtThisBeat === 9,
          });
        }

        if (orderIndex < rollingOrder.length - 1) {
          await waitForFeatureStagger(orderIndex);
          if (!clockRef.current) return plan.payout;
        }
      }

      visibleGrid = [...step.grid];
      setFeatureCells([...visibleGrid]);
      setFreshCells(new Set(step.addedIndices));
      setRollingCells(new Set());

      if (step.addedIndices.length > 0) {
        setPhase("feature-lock");
        const addedWild = step.addedIndices.some((index) => step.grid[index] === "wild");
        await wait(turbo ? 170 : step.isFullGrid ? 700 : addedWild ? 540 : 380);
      } else {
        setPhase("feature-miss");
        playTigerAudio({ type: "feature-miss" });
        await wait(turbo ? 110 : 330);
      }

      setFreshCells(new Set());
      if (step.ended) break;
    }

    setFeatureCells([...plan.finalGrid]);
    setRollingCells(new Set());
    setWinning(new Set(plan.winning));

    const featurePaylines = resolveGoldenTigerFeaturePaylines(plan.finalGrid, plan.selectedSymbol, bet);
    if (featurePaylines.length > 0) {
      setPhase("reveal");
      await presentPaylines(featurePaylines);
      setWinning(new Set(plan.winning));
      await wait(turbo ? 35 : 110);
    }

    setPhase("feature-outro");
    await wait(turbo ? 170 : 560);
    return plan.payout;
  }, [bet, playTigerAudio, presentPaylines, turbo, wait, waitForFeatureStagger]);

  const settle = useCallback(async (
    payout: number,
    visualStake: number,
    accountingStake: number,
    note: string,
    fullGrid: boolean,
  ) => {
    if (payout > 0) arcadeActions.credit(payout);
    arcadeActions.recordRound({
      slug: "golden-tiger",
      gameName: "Golden Tiger",
      bet: accountingStake,
      payout,
      multiplier: accountingStake > 0 && payout > 0 ? payout / accountingStake : 0,
      note,
    });
    setWin(payout);

    const rawTier = goldenTigerWinTier(payout, visualStake);
    const resolvedTier: GoldenTigerWinTier = payout > visualStake && rawTier === "none" ? "small" : rawTier;
    setWinTier(resolvedTier);

    const cinematicWin = fullGrid || resolvedTier === "big" || resolvedTier === "mega" || resolvedTier === "super";

    if (cinematicWin) {
      const timeline = goldenTigerWinTimeline(turbo, fullGrid);
      setPhase(fullGrid ? "full-grid" : "win");
      playTigerAudio(
        fullGrid
          ? { type: "full-grid" }
          : { type: "win", tier: resolvedTier === "none" ? "small" : resolvedTier },
      );

      setWinBeat("impact");
      await wait(timeline.impactMs);
      if (!clockRef.current) return;
      setWinBeat("reveal");
      scheduleGoldenTigerWinCounterAudio(
        timeline.revealMs,
        resolvedTier === "none" ? "small" : resolvedTier,
        soundEnabled,
        clockRef.current,
      );
      await wait(timeline.revealMs);
      if (!clockRef.current) return;
      setWinBeat("celebrate");
      playTigerAudio({
        type: "win-celebrate",
        tier: resolvedTier === "none" ? "small" : resolvedTier,
        fullGrid,
      });
      await wait(timeline.celebrateMs);
      if (!clockRef.current) return;
      setWinBeat(null);
    } else if (payout > visualStake) {
      setPhase("win");
      playTigerAudio({
        type: "win",
        tier: resolvedTier === "none" ? "small" : resolvedTier,
      });
      await wait(goldenTigerSettleHoldMs("simple-win", turbo));
    } else if (payout > 0) {
      setPhase("return");
      await wait(goldenTigerSettleHoldMs("return", turbo));
    } else {
      playTigerAudio({ type: "lose" });
      await wait(goldenTigerSettleHoldMs("lose", turbo));
    }
  }, [playTigerAudio, soundEnabled, turbo, wait]);

  const resetRoundPresentation = useCallback(() => {
    setWin(0);
    setWinTier("none");
    setWinBeat(null);
    setWinning(new Set());
    setActivePayline(null);
    setFreshCells(new Set());
    setRollingCells(new Set());
    setFeatureCells([...EMPTY_FEATURE_GRID]);
    setSelectedSymbol(null);
    setFeatureAttempt(0);
    setFeatureActive(false);
    setFeaturePurchased(false);
    setStoppedColumns(3);
    setBrakingColumn(-1);
    setLandingColumn(-1);
    setAnticipating(false);
  }, []);

  const finishRoundPresentation = useCallback(() => {
    setWinBeat(null);
    setPhase("idle");
    setWinning(new Set());
    setActivePayline(null);
    setFeatureActive(false);
    setFeaturePurchased(false);
    setFeatureCells([...EMPTY_FEATURE_GRID]);
    setSelectedSymbol(null);
    setFeatureAttempt(0);
    setRollingCells(new Set());
    setFreshCells(new Set());
    setStoppedColumns(3);
    setBrakingColumn(-1);
    setLandingColumn(-1);
    setAnticipating(false);
    busyRef.current = false;
  }, []);

  const runSpin = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    if (!arcadeActions.placeBet(bet)) {
      busyRef.current = false;
      playTigerAudio({ type: "lose" });
      return false;
    }

    try {
      resetRoundPresentation();
      setStoppedColumns(0);
      setPhase("base-spin");

      const nextGrid = makeGoldenTigerGrid(Math.random);
      const baseResult = evaluateGoldenTiger(nextGrid, bet);
      const basePaylines = resolveGoldenTigerBasePaylines(nextGrid, bet);
      const featureTriggered = rollFortuneFeatureTrigger(Math.random);
      const featurePlan = featureTriggered ? runFortuneFeature(bet, Math.random) : null;
      setGrid(nextGrid);
      playTigerAudio({ type: "spin" });
      await wait(goldenTigerSpinLaunchMs(turbo));

      for (let column = 0; column < 3; column += 1) {
        if (column === 2 && (baseResult.winning.size > 0 || featureTriggered)) {
          setAnticipating(true);
          playTigerAudio({ type: "anticipation" });
          await wait(goldenTigerAnticipationMs(turbo));
        }

        setLandingColumn(column);
        setBrakingColumn(column);
        await wait(goldenTigerReelBrakeMs(column, turbo));
        setStoppedColumns(column + 1);
        setBrakingColumn(-1);
        playTigerAudio({ type: "reel-land", column, featureHint: featureTriggered });
        await wait(goldenTigerReelLandPauseMs(column, turbo));
      }

      setLandingColumn(-1);
      setBrakingColumn(-1);
      setAnticipating(false);

      if (featurePlan) {
        playTigerAudio({ type: "feature-open" });
        const payout = await animateFeature(featurePlan, false);
        await settle(
          payout,
          bet,
          bet,
          `3×3 · Fortune Feature ${SYMBOL_LABEL[featurePlan.selectedSymbol]} · ${featurePlan.respinsUsed} respin(s) · ${featurePlan.lines} linha(s)`,
          featurePlan.isFullGrid,
        );
        return true;
      }

      setWinning(baseResult.winning);
      setPhase("reveal");
      if (baseResult.payout > bet) {
        playTigerAudio({ type: "reveal", winMultiple: baseResult.payout / bet });
      }

      if (basePaylines.length > 0) {
        await presentPaylines(basePaylines);
        setWinning(baseResult.winning);
        await wait(turbo ? 35 : 110);
      } else {
        await wait(turbo ? 55 : 110);
      }

      await settle(
        baseResult.payout,
        bet,
        bet,
        `3×3 · ${baseResult.lines} linha(s)${baseResult.isFullGrid ? ` · TELA CHEIA ×${GOLDEN_TIGER_FULL_GRID_MULTIPLIER}` : ""}`,
        baseResult.isFullGrid,
      );
      return true;
    } finally {
      finishRoundPresentation();
    }
  }, [animateFeature, bet, finishRoundPresentation, playTigerAudio, presentPaylines, resetRoundPresentation, settle, turbo, wait]);

  const buyBonus = useCallback(async () => {
    if (busyRef.current || autoLeft > 0 || balance < bonusCost) return;
    busyRef.current = true;
    setBonusOpen(false);

    if (!arcadeActions.debitCoins(bonusCost)) {
      busyRef.current = false;
      return;
    }

    try {
      resetRoundPresentation();
      const plan = runPurchasedFortuneFeature(bet, Math.random);
      const payout = await animateFeature(plan, true);
      await settle(
        payout,
        bet,
        bonusCost,
        `COMPRA Fortune Feature ${GOLDEN_TIGER_BONUS_BUY_MULTIPLIER}× · ${SYMBOL_LABEL[plan.selectedSymbol]} · ${plan.respinsUsed} respin(s) · ${plan.lines} linha(s)${plan.isFullGrid ? ` · TELA CHEIA ×${FORTUNE_FEATURE_FULL_GRID_MULTIPLIER}` : ""}`,
        plan.isFullGrid,
      );
    } finally {
      finishRoundPresentation();
    }
  }, [animateFeature, autoLeft, balance, bet, bonusCost, finishRoundPresentation, resetRoundPresentation, settle]);

  const startAuto = useCallback(async () => {
    if (busyRef.current || autoLeft > 0) return;
    autoStopRef.current = false;
    setAutoOpen(false);
    for (let left = autoRounds; left > 0; left -= 1) {
      if (autoStopRef.current) break;
      setAutoLeft(left);
      if (!(await runSpin())) break;
      await wait(turbo ? 90 : 250);
    }
    setAutoLeft(0);
  }, [autoLeft, autoRounds, runSpin, turbo, wait]);

  const changeBet = (direction: -1 | 1) => {
    if (busyRef.current || autoLeft > 0) return;
    const current = Math.max(0, BETS.findIndex((value) => value === bet));
    setBet(BETS[Math.max(0, Math.min(BETS.length - 1, current + direction))] ?? bet);
    playTigerAudio({ type: "click" });
  };

  const status =
    phase === "bonus-intro" ? "FORTUNE FEATURE COMPRADA · O TIGRE DESPERTA" :
    phase === "feature-intro" ? `FORTUNE FEATURE · ${selectedLabel}` :
    phase === "feature-spin" ? `RESPIN ${featureAttempt} · ${selectedLabel} + WILD` :
    phase === "feature-lock" ? "NOVO SÍMBOLO FIXO · FORTUNA CRESCE" :
    phase === "feature-miss" ? "RESPIN ENCERRADO" :
    phase === "feature-outro" ? `${lockedCount}/9 SÍMBOLOS · CONTANDO FORTUNA` :
    phase === "reveal" ? (winning.size > 0 ? "LINHA FORMADA" : "RESULTADO") :
    phase === "return" ? `RETORNO ${formatCoins(win)}` :
    phase === "full-grid" ? `TELA CHEIA · ×${GOLDEN_TIGER_FULL_GRID_MULTIPLIER}` :
    phase === "win" ? `GANHO ${formatCoins(win)}` :
    phase === "base-spin" ? "GIRANDO" :
    "BOA SORTE";

  return (
    <main className="gt-hw-page gt-premium-page">
      <section
        className="gt-hw-machine gt-premium-machine"
        data-phase={phase}
        data-feature-mode={featureActive ? "active" : "base"}
        data-feature-purchased={featurePurchased ? "true" : "false"}
        data-anticipating={anticipating ? "true" : "false"}
        data-win-beat={winBeat ?? "none"}
        aria-label="Golden Tiger"
      >
        <GoldenTigerScene25D lighting={sceneLighting} />

        <header className="gt-hw-topbar">
          <Link
            to="/"
            className="gt-hw-icon-button"
            onClick={() => { autoStopRef.current = true; }}
            aria-label="Voltar ao cassino"
          >
            <ArrowLeft />
          </Link>
          <div className="gt-hw-brand">
            <h1>GOLDEN TIGER</h1>
          </div>
          <button
            className="gt-hw-icon-button"
            type="button"
            onClick={() => arcadeActions.toggleSound()}
            aria-label={soundEnabled ? "Desativar som" : "Ativar som"}
          >
            {soundEnabled ? <Volume2 /> : <VolumeX />}
          </button>
        </header>

        <GoldenTigerTigerStage
          reaction={tigerReaction}
          featureActive={featureActive}
          lockedCount={lockedCount}
        />

        {featureActive && (
          <div className={cn("gt-hw-respin-panel is-active", phase === "feature-lock" && "is-reset")}>
            <span>FORTUNE</span>
            <strong>{selectedLabel}</strong>
            <small>{lockedCount}/9 · R{featureAttempt}</small>
          </div>
        )}

        <div
          className="gt-hw-grid gt-premium-grid"
          data-reel-surface="continuous"
          data-landing-column={landingColumn}
          data-reveal={phase === "reveal" ? "true" : "false"}
          aria-label="Grade de símbolos 3 por 3"
        >
          <span className="gt-commercial-reel-cylinder is-0" aria-hidden />
          <span className="gt-commercial-reel-cylinder is-1" aria-hidden />
          <span className="gt-commercial-reel-cylinder is-2" aria-hidden />
          {grid.map((symbol, index) => {
            const featureSymbol = featureCells[index] ?? null;
            const locked = featureActive && featureSymbol !== null;
            const winningCell = winning.has(index) && (!featureActive || locked);
            return (
              <div
                className={cn(
                  "gt-hw-cell",
                  winningCell && "is-winning",
                  activePayline?.cells.includes(index) && "is-payline-focus",
                  activePayline && !activePayline.cells.includes(index) && "is-payline-muted",
                  locked && "is-locked",
                  freshCells.has(index) && "is-fresh",
                  featureActive && featureSymbol === null && "is-feature-blank",
                )}
                key={index}
              >
                {featureActive ? (
                  featureSymbol ? <GoldenTigerSymbol id={featureSymbol} isWinning={winningCell} /> : <span className="gt-hw-feature-blank" aria-hidden />
                ) : (
                  <GoldenTigerSymbol id={symbol} isWinning={winningCell} />
                )}
                {featureActive && selectedSymbol && rollingCells.has(index) && (
                  <FeatureCellMotion selectedSymbol={selectedSymbol} index={index} />
                )}
                {locked && (
                  <span className="gt-premium-lock-ring" aria-hidden>
                    {freshCells.has(index) && <><i /><i /><i /><i /></>}
                  </span>
                )}
              </div>
            );
          })}

          {phase === "base-spin" && [0, 1, 2]
            .filter((column) => column >= stoppedColumns)
            .map((column) => (
              <ReelOverlay
                column={column}
                turbo={turbo}
                braking={brakingColumn === column}
                finalSymbols={reelFinalSymbols(grid, column)}
                key={column}
              />
            ))}

          {activePayline && (
            <div className="gt-rework-payline-stage" aria-hidden>
              <svg viewBox="0 0 3 3" preserveAspectRatio="none">
                <polyline points={activePayline.points} pathLength={1} />
              </svg>
              <span>
                LINHA {activePayline.index + 1} · +{formatCoins(activePayline.payout)}
              </span>
            </div>
          )}

          <span className="gt-hw-grid-glass" aria-hidden />
        </div>

        <div className="gt-hw-status" role="status" aria-live="polite">
          <Sparkles aria-hidden />
          <span>{status}</span>
        </div>

        <div className="gt-hw-hud">
          <div><span>SALDO</span><strong>{formatCoins(balance)}</strong></div>
          <div><span>APOSTA</span><strong>{formatCoins(bet)}</strong></div>
        </div>

        <div className="gt-hw-controls gt-premium-controls gt-commercial-console">
          <div className="gt-hw-main-controls">
            <button type="button" onClick={() => changeBet(-1)} disabled={isBusy || autoLeft > 0} aria-label="Diminuir aposta">−</button>
            <button type="button" className="gt-hw-spin" onClick={() => void runSpin()} disabled={isBusy || autoLeft > 0 || balance < bet} aria-label="Girar"><span /></button>
            <button type="button" onClick={() => changeBet(1)} disabled={isBusy || autoLeft > 0} aria-label="Aumentar aposta">+</button>
          </div>

          <div className="gt-hw-secondary-controls gt-premium-secondary">
            <button
              type="button"
              className={cn(turbo && "is-active")}
              onClick={() => setTurbo((value) => !value)}
              disabled={isBusy || autoLeft > 0}
              aria-pressed={turbo}
            >
              <Zap /><span>TURBO</span>
            </button>
            <button
              type="button"
              className="gt-premium-bonus-button"
              onClick={() => setBonusOpen(true)}
              disabled={isBusy || autoLeft > 0 || balance < bonusCost}
            >
              <Gift /><span>BÔNUS</span>
            </button>
            {autoLeft > 0 ? (
              <button type="button" className="is-active" onClick={() => { autoStopRef.current = true; }}>
                <strong>{autoLeft}</strong><span>PARAR</span>
              </button>
            ) : (
              <button type="button" onClick={() => setAutoOpen(true)} disabled={isBusy || balance < bet}>
                <strong>A</strong><span>AUTO</span>
              </button>
            )}
          </div>
        </div>

        <p className="gt-hw-fictional">ENTRETENIMENTO · CRÉDITOS 100% FICTÍCIOS · SEM VALOR MONETÁRIO</p>

        {(phase === "bonus-intro" || phase === "feature-intro") && featureActive && (
          <div className="gt-premium-feature-title" aria-live="polite">
            <small>{featurePurchased ? "FEATURE COMPRADA" : "FEATURE ATIVADA"}</small>
            <strong>FORTUNE FEATURE</strong>
            <span>{selectedLabel} + WILD</span>
          </div>
        )}

        {phase === "win" && win > 0 && (winTier === "small" || winTier === "nice") && (
          <div className={cn("gt-hw-win-ribbon", `is-${winTier}`)} aria-live="polite">
            <span>{winTier === "nice" ? "BOM GANHO" : "GANHO"}</span>
            <AnimatedWinCounter value={win} duration={reducedMotion() ? 0 : 620} />
          </div>
        )}

        {((phase === "win" && (winTier === "big" || winTier === "mega" || winTier === "super")) || phase === "full-grid") && win > 0 && winBeat && (
          <GoldenTigerWinStage
            value={win}
            tier={winTier}
            fullGrid={phase === "full-grid"}
            beat={winBeat}
            countUpMs={goldenTigerWinTimeline(turbo, phase === "full-grid").revealMs}
            reducedMotion={reducedMotion()}
          />
        )}

        {bonusOpen && (
          <div className="gt-hw-modal gt-premium-bonus-modal" role="dialog" aria-modal="true" aria-label="Comprar Fortune Feature">
            <div>
              <span>FORTUNE FEATURE</span>
              <h2>COMPRAR O BÔNUS?</h2>
              <div className="gt-premium-bonus-medallion" aria-hidden>福</div>
              <p>Entre diretamente em uma Fortune Feature reforçada. O símbolo escolhido e os WILDs ficam fixos, com maior chance de novos símbolos em cada respin.</p>
              <dl>
                <div><dt>APOSTA BASE</dt><dd>{formatCoins(bet)}</dd></div>
                <div><dt>CUSTO</dt><dd>{formatCoins(bonusCost)} · {GOLDEN_TIGER_BONUS_BUY_MULTIPLIER}×</dd></div>
                <div><dt>TELA CHEIA</dt><dd>GANHOS ×{FORTUNE_FEATURE_FULL_GRID_MULTIPLIER}</dd></div>
              </dl>
              <footer>
                <button type="button" onClick={() => setBonusOpen(false)}>CANCELAR</button>
                <button type="button" className="is-buy" onClick={() => void buyBonus()} disabled={balance < bonusCost}>ATIVAR FEATURE</button>
              </footer>
            </div>
          </div>
        )}

        {autoOpen && (
          <div className="gt-hw-modal" role="dialog" aria-modal="true" aria-label="Configurar Auto Play">
            <div>
              <span>AUTO PLAY</span>
              <h2>ESCOLHA AS RODADAS</h2>
              <p>{formatCoins(bet)} créditos fictícios por rodada</p>
              <nav>
                {[10, 25, 50, 100].map((rounds) => (
                  <button
                    key={rounds}
                    type="button"
                    className={autoRounds === rounds ? "is-active" : ""}
                    onClick={() => setAutoRounds(rounds)}
                  >
                    {rounds}
                  </button>
                ))}
              </nav>
              <footer>
                <button type="button" onClick={() => setAutoOpen(false)}>CANCELAR</button>
                <button type="button" onClick={() => void startAuto()}>INICIAR</button>
              </footer>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
