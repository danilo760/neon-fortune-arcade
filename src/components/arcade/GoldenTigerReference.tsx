import { Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles, Volume2, VolumeX, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AnimatedWinCounter } from "./AnimatedWinCounter";
import { GoldenTigerSymbol } from "./golden-tiger/GoldenTigerSymbols";
import { GoldenTigerTigerStage, type TigerReactionState } from "./golden-tiger/GoldenTigerTigerStage";
import { formatCoins } from "@/lib/arcade/format";
import { playGoldenTigerAudio } from "@/lib/arcade/goldenTigerAudio";
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
  goldenTigerReelBrakeMs,
  goldenTigerReelLandPauseMs,
  goldenTigerSpinLaunchMs,
} from "@/lib/arcade/goldenTigerMotion";
import { setAmbienceEnergy, setGameAmbience } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";
import "./GoldenTigerReference.css";

const BETS = [10, 20, 50, 100, 200, 500, 1_000] as const;
const INITIAL_GRID: GoldenTigerSymbolId[] = ["fortuneBag", "ingot", "jade", "orange", "wild", "firecracker", "lion", "lantern", "fortuneBag"];
const REEL_STRIP: readonly GoldenTigerSymbolId[] = ["orange", "jade", "firecracker", "fortuneBag", "ingot", "lantern", "lion", "wild"];
const CELL_INDEXES = Array.from({ length: 9 }, (_, index) => index);
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
  | "feature-intro"
  | "feature-spin"
  | "feature-lock"
  | "feature-miss"
  | "return"
  | "win"
  | "full-grid";

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion() ? 24 : ms));
}

function reelFinalSymbols(
  grid: readonly GoldenTigerSymbolId[],
  column: number,
): [GoldenTigerSymbolId, GoldenTigerSymbolId, GoldenTigerSymbolId] {
  return [
    grid[column] ?? "orange",
    grid[column + 3] ?? "jade",
    grid[column + 6] ?? "ingot",
  ];
}

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
  const symbols = [
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
    let offset = 0;
    let initialized = false;
    let brakeStartedAt: number | null = null;
    let brakeStartOffset = 0;

    const draw = (time: number) => {
      const itemHeight = overlay.clientHeight / 3;
      if (itemHeight <= 0) {
        frameId = requestAnimationFrame(draw);
        return;
      }

      if (!initialized) {
        offset = itemHeight * REEL_STRIP.length;
        initialized = true;
      }

      const finalOffset = itemHeight * (symbols.length - 3);
      const isBraking = brakingRef.current;

      if (isBraking) {
        if (reducedMotion()) {
          track.style.transform = `translateY(${-finalOffset}px)`;
          return;
        }
        if (brakeStartedAt === null) {
          brakeStartedAt = time;
          brakeStartOffset = offset;
        }
        const duration = goldenTigerReelBrakeMs(column, turbo);
        const progress = Math.min(1, (time - brakeStartedAt) / duration);
        const eased = goldenTigerBrakeEase(progress);
        offset = brakeStartOffset + (finalOffset - brakeStartOffset) * eased;
        track.style.transform = `translateY(${-offset}px)`;
        if (progress >= 1) return;
      } else {
        const delta = Math.min(34, Math.max(0, time - lastTime));
        const pxPerMs = itemHeight / (turbo ? 40 : 64);
        offset += pxPerMs * delta;
        const wrapAt = itemHeight * REEL_STRIP.length * 3;
        if (offset >= wrapAt) offset -= itemHeight * REEL_STRIP.length;
        track.style.transform = `translateY(${-offset}px)`;
      }

      lastTime = time;
      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
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
          <span key={`${index}-${item}-${symbol}`}><GoldenTigerSymbol id={symbol} /></span>
        ))}
      </div>
    </div>
  );
}

export function GoldenTigerReference() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const [bet, setBet] = useState<number>(20);
  const [grid, setGrid] = useState<GoldenTigerSymbolId[]>(INITIAL_GRID);
  const [featureCells, setFeatureCells] = useState<FortuneFeatureCell[]>(EMPTY_FEATURE_GRID);
  const [selectedSymbol, setSelectedSymbol] = useState<GoldenTigerSymbolId | null>(null);
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [freshCells, setFreshCells] = useState<Set<number>>(() => new Set());
  const [rollingCells, setRollingCells] = useState<Set<number>>(() => new Set());
  const [featureAttempt, setFeatureAttempt] = useState(0);
  const [stoppedColumns, setStoppedColumns] = useState(3);
  const [brakingColumn, setBrakingColumn] = useState(-1);
  const [landingColumn, setLandingColumn] = useState(-1);
  const [anticipating, setAnticipating] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [featureActive, setFeatureActive] = useState(false);
  const [win, setWin] = useState(0);
  const [winTier, setWinTier] = useState<GoldenTigerWinTier>("none");
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [autoRounds, setAutoRounds] = useState(10);
  const [autoOpen, setAutoOpen] = useState(false);
  const busyRef = useRef(false);
  const autoStopRef = useRef(false);

  useEffect(() => {
    hydrateFromStorage();
    return () => { autoStopRef.current = true; };
  }, []);

  useEffect(() => {
    setGameAmbience("tiger", soundEnabled);
    return () => setGameAmbience("tiger", false);
  }, [soundEnabled]);

  useEffect(() => {
    const energy =
      phase === "full-grid" ? 1.42 :
      phase === "win" ? (winTier === "super" ? 1.46 : winTier === "mega" ? 1.38 : winTier === "big" ? 1.28 : 1.12) :
      phase === "reveal" ? 0.98 :
      phase === "return" ? 0.74 :
      featureActive ? (phase === "feature-spin" ? 1.12 : 1.25) :
      phase === "base-spin" ? 0.92 : 0.72;
    setAmbienceEnergy(energy);
  }, [featureActive, phase, winTier]);

  const isBusy = phase !== "idle";
  const lockedCount = featureCells.reduce((count, symbol) => count + (symbol === null ? 0 : 1), 0);
  const selectedLabel = selectedSymbol ? SYMBOL_LABEL[selectedSymbol] : "—";
  const tigerReaction: TigerReactionState =
    phase === "full-grid" ? "full" :
    phase === "feature-intro" || phase === "feature-lock" ? "feature" :
    anticipating || (featureActive && lockedCount >= 6) ? "tense" :
    phase === "reveal" ? "reveal" :
    phase === "base-spin" || phase === "feature-spin" ? "watch" :
    phase === "win" ? "win" : "idle";

  const animateFeature = useCallback(async (plan: FortuneFeatureResult) => {
    let visibleGrid: FortuneFeatureCell[] = [...EMPTY_FEATURE_GRID];
    setFeatureCells([...visibleGrid]);
    setSelectedSymbol(plan.selectedSymbol);
    setFeatureAttempt(0);
    setFreshCells(new Set());
    setWinning(new Set());
    setFeatureActive(true);
    setPhase("feature-intro");
    await wait(turbo ? 180 : 520);

    for (const step of plan.steps) {
      setFeatureAttempt(step.respin);
      const lockedBeforeSpin = visibleGrid.reduce((count, symbol) => count + (symbol === null ? 0 : 1), 0);
      setRollingCells(new Set(CELL_INDEXES.filter((index) => visibleGrid[index] === null)));
      setPhase("feature-spin");
      playGoldenTigerAudio({
        type: "feature-respin",
        attempt: step.respin,
        lockedCount: lockedBeforeSpin,
      }, soundEnabled);
      await wait(turbo ? 170 : 440);

      visibleGrid = [...step.grid];
      setFeatureCells([...visibleGrid]);
      setFreshCells(new Set(step.addedIndices));
      await wait(turbo ? 20 : 55);
      setRollingCells(new Set());

      if (step.addedIndices.length > 0) {
        setPhase("feature-lock");
        const addedWild = step.addedIndices.some((index) => step.grid[index] === "wild");
        const lockedAfterSpin = visibleGrid.reduce((count, symbol) => count + (symbol === null ? 0 : 1), 0);
        playGoldenTigerAudio({
          type: "feature-lock",
          lockedCount: lockedAfterSpin,
          addedWild,
          fullGrid: step.isFullGrid,
        }, soundEnabled);
        await wait(turbo ? 170 : step.isFullGrid ? 620 : addedWild ? 480 : 340);
      } else {
        setPhase("feature-miss");
        playGoldenTigerAudio({ type: "feature-miss" }, soundEnabled);
        await wait(turbo ? 110 : 320);
      }

      setFreshCells(new Set());
      if (step.ended) break;
    }

    setFeatureCells([...plan.finalGrid]);
    setRollingCells(new Set());
    setWinning(new Set(plan.winning));
    return plan.payout;
  }, [soundEnabled, turbo]);

  const settle = useCallback(async (payout: number, stake: number, note: string, fullGrid: boolean) => {
    if (payout > 0) arcadeActions.credit(payout);
    arcadeActions.recordRound({
      slug: "golden-tiger",
      gameName: "Golden Tiger",
      bet: stake,
      payout,
      multiplier: stake > 0 && payout > 0 ? payout / stake : 0,
      note,
    });
    setWin(payout);

    const rawTier = goldenTigerWinTier(payout, stake);
    const resolvedTier: GoldenTigerWinTier = payout > stake && rawTier === "none" ? "small" : rawTier;
    setWinTier(resolvedTier);

    if (fullGrid) {
      setPhase("full-grid");
      playGoldenTigerAudio({ type: "full-grid" }, soundEnabled);
      await wait(turbo ? 650 : 1900);
    } else if (payout > stake) {
      setPhase("win");
      playGoldenTigerAudio({
        type: "win",
        tier: resolvedTier === "none" ? "small" : resolvedTier,
      }, soundEnabled);
      await wait(
        turbo ? 260 :
        resolvedTier === "super" ? 1900 :
        resolvedTier === "mega" ? 1600 :
        resolvedTier === "big" ? 1280 :
        resolvedTier === "nice" ? 780 : 560,
      );
    } else if (payout > 0) {
      setPhase("return");
      await wait(turbo ? 90 : 260);
    } else {
      playGoldenTigerAudio({ type: "lose" }, soundEnabled);
      await wait(turbo ? 70 : 160);
    }
  }, [soundEnabled, turbo]);

  const runSpin = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    if (!arcadeActions.placeBet(bet)) {
      busyRef.current = false;
      playGoldenTigerAudio({ type: "lose" }, soundEnabled);
      return false;
    }

    try {
      setWin(0);
      setWinTier("none");
      setWinning(new Set());
      setFreshCells(new Set());
      setRollingCells(new Set());
      setFeatureCells([...EMPTY_FEATURE_GRID]);
      setSelectedSymbol(null);
      setFeatureAttempt(0);
      setFeatureActive(false);
      setStoppedColumns(0);
      setBrakingColumn(-1);
      setLandingColumn(-1);
      setAnticipating(false);
      setPhase("base-spin");

      const nextGrid = makeGoldenTigerGrid(Math.random);
      const baseResult = evaluateGoldenTiger(nextGrid, bet);
      const featureTriggered = rollFortuneFeatureTrigger(Math.random);
      const featurePlan = featureTriggered ? runFortuneFeature(bet, Math.random) : null;
      setGrid(nextGrid);
      playGoldenTigerAudio({ type: "spin" }, soundEnabled);
      await wait(goldenTigerSpinLaunchMs(turbo));

      for (let column = 0; column < 3; column += 1) {
        if (column === 2 && (baseResult.winning.size > 0 || featureTriggered)) {
          setAnticipating(true);
          playGoldenTigerAudio({ type: "anticipation" }, soundEnabled);
          await wait(goldenTigerAnticipationMs(turbo));
        }

        setLandingColumn(column);
        setBrakingColumn(column);
        await wait(goldenTigerReelBrakeMs(column, turbo));
        setStoppedColumns(column + 1);
        setBrakingColumn(-1);

        playGoldenTigerAudio({
          type: "reel-land",
          column,
          featureHint: featureTriggered,
        }, soundEnabled);
        await wait(goldenTigerReelLandPauseMs(column, turbo));
      }

      setLandingColumn(-1);
      setBrakingColumn(-1);
      setAnticipating(false);

      if (featurePlan) {
        setWinning(new Set());
        playGoldenTigerAudio({ type: "feature-open" }, soundEnabled);
        const featurePayout = await animateFeature(featurePlan);
        await settle(
          featurePayout,
          bet,
          `3×3 · Fortune Feature ${SYMBOL_LABEL[featurePlan.selectedSymbol]} · ${featurePlan.respinsUsed} respin(s) · ${featurePlan.lines} linha(s)${featurePlan.isFullGrid ? ` · TELA CHEIA ×${GOLDEN_TIGER_FULL_GRID_MULTIPLIER}` : ""}`,
          featurePlan.isFullGrid,
        );
        return true;
      }

      setWinning(baseResult.winning);
      setPhase("reveal");
      if (baseResult.payout > bet) {
        playGoldenTigerAudio({
          type: "reveal",
          winMultiple: baseResult.payout / bet,
        }, soundEnabled);
      }
      await wait(turbo ? 55 : baseResult.winning.size > 0 ? 180 : 110);

      await settle(
        baseResult.payout,
        bet,
        `3×3 · ${baseResult.lines} linha(s)${baseResult.isFullGrid ? ` · TELA CHEIA ×${GOLDEN_TIGER_FULL_GRID_MULTIPLIER}` : ""}`,
        baseResult.isFullGrid,
      );
      return true;
    } finally {
      setPhase("idle");
      setFeatureActive(false);
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
    }
  }, [animateFeature, bet, settle, soundEnabled, turbo]);

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
  }, [autoLeft, autoRounds, runSpin, turbo]);

  const changeBet = (direction: -1 | 1) => {
    if (busyRef.current || autoLeft > 0) return;
    const current = Math.max(0, BETS.findIndex((value) => value === bet));
    setBet(BETS[Math.max(0, Math.min(BETS.length - 1, current + direction))] ?? bet);
    playGoldenTigerAudio({ type: "click" }, soundEnabled);
  };

  const status =
    phase === "feature-intro" ? `FORTUNE FEATURE · ${selectedLabel}` :
    phase === "feature-spin" ? `RESPIN ${featureAttempt} · ${selectedLabel} + WILD` :
    phase === "feature-lock" ? "NOVO SÍMBOLO · RESPIN CONTINUA" :
    phase === "feature-miss" ? "SEM NOVO SÍMBOLO · FEATURE ENCERRADA" :
    phase === "reveal" ? (winning.size > 0 ? "LINHA FORMADA" : "RESULTADO") :
    phase === "return" ? `RETORNO ${formatCoins(win)}` :
    phase === "full-grid" ? `TELA CHEIA · ×${GOLDEN_TIGER_FULL_GRID_MULTIPLIER}` :
    phase === "win" ? `GANHO ${formatCoins(win)}` :
    "FORTUNE FEATURE PODE SURGIR A QUALQUER GIRO";

  return (
    <main className="gt-hw-page">
      <section
        className="gt-hw-machine"
        data-phase={phase}
        data-anticipating={anticipating ? "true" : "false"}
        aria-label="Golden Tiger"
      >
        <div className="gt-hw-backdrop" aria-hidden />
        <div className="gt-hw-ambient" aria-hidden>
          {Array.from({ length: 14 }, (_, index) => <i key={index} />)}
        </div>

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
            <small>NEON FORTUNE ARCADE</small>
            <h1>GOLDEN TIGER</h1>
            <span>FORTUNE FEATURE</span>
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

        <div className={cn("gt-hw-respin-panel", featureActive && "is-active", phase === "feature-lock" && "is-reset")}>
          <span>{featureActive ? "SÍMBOLO" : "PRÊMIO MÁXIMO"}</span>
          <strong>{featureActive ? selectedLabel : `GRID ×${GOLDEN_TIGER_FULL_GRID_MULTIPLIER}`}</strong>
          <small>{featureActive ? `${lockedCount}/9 FIXOS · R${featureAttempt}` : "5 LINHAS FIXAS"}</small>
        </div>

        <div
          className="gt-hw-grid"
          data-landing-column={landingColumn}
          data-reveal={phase === "reveal" ? "true" : "false"}
          aria-label="Grade de símbolos 3 por 3"
        >
          {grid.map((symbol, index) => {
            const featureSymbol = featureCells[index] ?? null;
            const locked = featureActive && featureSymbol !== null;
            const winningCell = winning.has(index) && (!featureActive || locked);
            return (
              <div
                className={cn(
                  "gt-hw-cell",
                  winningCell && "is-winning",
                  locked && "is-locked",
                  freshCells.has(index) && "is-fresh",
                  featureActive && featureSymbol === null && "is-feature-blank",
                )}
                key={index}
              >
                {featureActive ? (
                  featureSymbol ? (
                    <GoldenTigerSymbol id={featureSymbol} isWinning={winningCell} />
                  ) : (
                    <span className="gt-hw-feature-blank" aria-hidden />
                  )
                ) : (
                  <GoldenTigerSymbol id={symbol} isWinning={winningCell} />
                )}
                {featureActive && selectedSymbol && rollingCells.has(index) && (
                  <FeatureCellMotion selectedSymbol={selectedSymbol} index={index} />
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
          <span className="gt-hw-grid-glass" aria-hidden />
        </div>

        <div className="gt-hw-status" role="status" aria-live="polite">
          <Sparkles aria-hidden />
          <span>{status}</span>
        </div>

        <div className="gt-hw-hud">
          <div><span>SALDO</span><strong>{formatCoins(balance)}</strong></div>
          <div><span>APOSTA</span><strong>{formatCoins(bet)}</strong></div>
          <div><span>GANHO</span><strong>{formatCoins(win)}</strong></div>
        </div>

        <div className="gt-hw-controls">
          <div className="gt-hw-main-controls">
            <button type="button" onClick={() => changeBet(-1)} disabled={isBusy || autoLeft > 0} aria-label="Diminuir aposta">−</button>
            <button type="button" className="gt-hw-spin" onClick={() => void runSpin()} disabled={isBusy || autoLeft > 0 || balance < bet} aria-label="Girar"><span /></button>
            <button type="button" onClick={() => changeBet(1)} disabled={isBusy || autoLeft > 0} aria-label="Aumentar aposta">+</button>
          </div>

          <div className="gt-hw-secondary-controls">
            <button
              type="button"
              className={cn(turbo && "is-active")}
              onClick={() => setTurbo((value) => !value)}
              disabled={isBusy || autoLeft > 0}
              aria-pressed={turbo}
            >
              <Zap /><span>TURBO</span>
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

        {phase === "win" && win > 0 && (winTier === "small" || winTier === "nice") && (
          <div className={cn("gt-hw-win-ribbon", `is-${winTier}`)} aria-live="polite">
            <span>{winTier === "nice" ? "BOM GANHO" : "GANHO"}</span>
            <AnimatedWinCounter value={win} duration={reducedMotion() ? 0 : winTier === "nice" ? 620 : 420} />
          </div>
        )}

        {((phase === "win" && (winTier === "big" || winTier === "mega" || winTier === "super")) || phase === "full-grid") && win > 0 && (
          <div className={cn("gt-hw-win-overlay", phase === "full-grid" && "is-full", (winTier === "mega" || winTier === "super") && "is-mega", winTier === "super" && "is-super")}>
            <div className="gt-hw-win-rays" aria-hidden />
            <div className="gt-hw-win-crown" aria-hidden>✦</div>
            <span>{phase === "full-grid" ? "TELA CHEIA" : winTier === "super" ? "SUPER MEGA GANHO" : winTier === "mega" ? "MEGA GANHO" : "GRANDE GANHO"}</span>
            <AnimatedWinCounter value={win} duration={reducedMotion() ? 0 : phase === "full-grid" ? 1500 : winTier === "super" ? 1600 : winTier === "mega" ? 1300 : 950} />
            {phase === "full-grid" && <small>GANHOS × {FORTUNE_FEATURE_FULL_GRID_MULTIPLIER}</small>}
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
