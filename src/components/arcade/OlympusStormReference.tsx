import { Link } from "@tanstack/react-router";
import { Volume2, VolumeX } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { olympusStormReferenceBase64 } from "@/assets/olympus-storm/referenceData";
import { formatCoins } from "@/lib/arcade/format";
import {
  OLYMPUS_COLUMNS,
  OLYMPUS_FEATURE_BUY_INITIAL_SPINS,
  OLYMPUS_STORM_LEVEL_MULTIPLIERS,
  OLYMPUS_STORM_LEVEL_THRESHOLDS,
  olympusFeatureBuyCost,
  planOlympusFeature,
  planOlympusRound,
  type OlympusFeaturePlan,
  type OlympusRoundPlan,
  type OlympusStormLevel,
  type OlympusSymbolId,
} from "@/lib/arcade/olympusStormMath";
import {
  createOlympusFeatureBuyLock,
  olympusFeatureBuyAvailability,
} from "@/lib/arcade/olympusStormFeatureBuy";
import { playOlympusLevelUp, playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import { AnimatedWinCounter } from "./AnimatedWinCounter";
import "./OlympusStormReference.css";

type Crop = { x: number; y: number; w: number; h: number };
type PresentationPhase =
  | "idle"
  | "spinning"
  | "landing"
  | "anticipation"
  | "clusterWin"
  | "stormCharge"
  | "stormHit"
  | "stormImpact"
  | "collapse"
  | "bonusTrigger"
  | "featureCinematic"
  | "bonusIntro"
  | "bonusPlaying"
  | "levelUp"
  | "retrigger"
  | "bonusOutro"
  | "settled";

type BonusSource = "natural" | "featureBuy" | null;

const FULL_W = 941;
const FULL_H = 1672;

const CROPS: Record<Exclude<OlympusSymbolId, "scatter">, Crop> = {
  bolt: { x: 75, y: 414, w: 258, h: 235 },
  crown: { x: 333, y: 414, w: 257, h: 235 },
  chalice: { x: 590, y: 414, w: 264, h: 235 },
  coin: { x: 75, y: 650, w: 258, h: 234 },
  hammer: { x: 333, y: 650, w: 257, h: 234 },
  orb: { x: 590, y: 650, w: 264, h: 234 },
  zeus: { x: 333, y: 884, w: 257, h: 233 },
};

const BET_STEPS = [10, 50, 100, 200, 500, 1_000, 5_000, 10_000] as const;
const INITIAL_GRID: OlympusSymbolId[] = [
  "bolt", "crown", "chalice", "coin", "hammer", "orb",
  "coin", "hammer", "orb", "crown", "bolt", "chalice",
  "crown", "zeus", "bolt", "orb", "coin", "chalice",
  "hammer", "orb", "coin", "bolt", "crown", "zeus",
  "orb", "coin", "chalice", "hammer", "bolt", "crown",
];

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
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

const ReferenceSymbol = memo(function ReferenceSymbol({ id, src }: { id: OlympusSymbolId; src: string }) {
  if (id === "scatter") {
    return (
      <div className="os-storm-orb-symbol absolute inset-0" aria-label="Storm Orb">
        <span className="os-storm-orb-runes" aria-hidden>ᛟ</span>
        <span className="os-storm-orb-core" aria-hidden />
      </div>
    );
  }

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
});

const OlympusGrid = memo(function OlympusGrid({
  grid,
  src,
  winning,
  phase,
  revealedColumns,
}: {
  grid: OlympusSymbolId[];
  src: string;
  winning: Set<number>;
  phase: PresentationPhase;
  revealedColumns: number;
}) {
  return (
    <div
      className={cn(
        "os-ref-grid absolute left-[7.95%] top-[24.76%] z-20 grid h-[53.05%] w-[82.9%] grid-cols-6 grid-rows-5 overflow-hidden",
        phase === "spinning" && "os-ref-grid--spinning",
        phase === "landing" && "os-ref-grid--landing",
        phase === "anticipation" && "os-ref-grid--anticipation",
        phase === "collapse" && "os-ref-grid--collapse",
        phase === "stormImpact" && "os-ref-grid--storm-hit",
        phase === "bonusPlaying" && "os-ref-grid--bonus",
      )}
    >
      {grid.map((symbol, index) => {
        const column = index % OLYMPUS_COLUMNS;
        const hidden = phase === "landing" || phase === "anticipation" ? column >= revealedColumns : false;
        return (
          <div
            key={index}
            className={cn(
              "os-ref-cell relative overflow-hidden border border-[#9fdcff]/20 bg-[#031735]",
              winning.has(index) && "os-ref-win",
              hidden && "os-ref-cell--hidden",
              symbol === "scatter" && "os-ref-cell--scatter",
            )}
          >
            <ReferenceSymbol id={symbol} src={src} />
          </div>
        );
      })}
    </div>
  );
});

function visibleScatterCount(grid: readonly OlympusSymbolId[], columns: number) {
  return grid.reduce((count, symbol, index) =>
    count + (symbol === "scatter" && index % OLYMPUS_COLUMNS < columns ? 1 : 0), 0);
}

export function OlympusStormReference() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const { src, failed } = useReferenceBlob();

  const [bet, setBet] = useState<number>(200);
  const [grid, setGrid] = useState<OlympusSymbolId[]>(INITIAL_GRID);
  const [win, setWin] = useState(0);
  const [winDuration, setWinDuration] = useState(0);
  const [roundBusy, setRoundBusy] = useState(false);
  const [phase, setPhase] = useState<PresentationPhase>("idle");
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [stormMultiplier, setStormMultiplier] = useState(1);
  const [cascadeNumber, setCascadeNumber] = useState(0);
  const [clusterCount, setClusterCount] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [revealedColumns, setRevealedColumns] = useState(OLYMPUS_COLUMNS);
  const [bonusActive, setBonusActive] = useState(false);
  const [bonusSource, setBonusSource] = useState<BonusSource>(null);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0);
  const [stormLevel, setStormLevel] = useState<OlympusStormLevel>(1);
  const [stormEnergy, setStormEnergy] = useState(0);
  const [levelPulseKey, setLevelPulseKey] = useState(0);
  const [bonusTotal, setBonusTotal] = useState(0);
  const [bonusIntroSpins, setBonusIntroSpins] = useState(0);
  const [retriggerAward, setRetriggerAward] = useState(0);
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [featurePending, setFeaturePending] = useState(false);

  const busyRef = useRef(false);
  const autoStopRef = useRef(false);
  const featureBuyLockRef = useRef(createOlympusFeatureBuyLock());

  useEffect(() => hydrateFromStorage(), []);

  const revealInitialGrid = useCallback(async (plan: OlympusRoundPlan) => {
    setGrid(plan.initialGrid);
    setWinning(new Set());
    setPhase("landing");

    if (turbo) {
      setRevealedColumns(OLYMPUS_COLUMNS);
      playSound(plan.scatterCount > 0 ? "olympusScatter" : "tick", soundEnabled);
      await wait(90);
      return;
    }

    setRevealedColumns(0);
    let previousScatterCount = 0;
    for (let columns = 1; columns <= OLYMPUS_COLUMNS; columns += 1) {
      setRevealedColumns(columns);
      const scatterCount = visibleScatterCount(plan.initialGrid, columns);
      if (scatterCount > previousScatterCount) {
        playSound("olympusScatter", soundEnabled);
        previousScatterCount = scatterCount;
      } else {
        playSound("tick", soundEnabled);
      }

      if (scatterCount >= 2 && columns < OLYMPUS_COLUMNS) {
        setPhase("anticipation");
        playSound("olympusAnticipation", soundEnabled);
        await wait(360);
        setPhase("landing");
      }
      await wait(scatterCount >= 2 && columns < OLYMPUS_COLUMNS ? 120 : 72);
    }
  }, [soundEnabled, turbo]);

  const presentRound = useCallback(async (
    plan: OlympusRoundPlan,
    displayedTotalStart: number,
    isBonusRound: boolean,
  ) => {
    setPhase("spinning");
    setWinning(new Set());
    setStormMultiplier(1);
    setCascadeNumber(0);
    setClusterCount(0);
    setWinDuration(0);
    playSound(isBonusRound ? "olympusBonusSpin" : "olympusSpin", soundEnabled);
    await wait(turbo ? 150 : 420);

    await revealInitialGrid(plan);
    let displayedTotal = displayedTotalStart;

    for (let index = 0; index < plan.cascades.length; index += 1) {
      const cascade = plan.cascades[index];
      if (!cascade) continue;

      setGrid(cascade.grid);
      setWinning(new Set(cascade.winning));
      setCascadeNumber(index + 1);
      setClusterCount(cascade.clusters.length);
      setStormMultiplier(1);
      setStormLevel(cascade.stormLevel);
      setStormEnergy(cascade.stormEnergyBefore);
      setPhase("clusterWin");
      playSound("olympusCluster", soundEnabled);
      await wait(turbo ? 130 : Math.min(300 + index * 55, 520));

      if (cascade.multiplier > 1) {
        setStormMultiplier(cascade.multiplier);
        setPhase("stormCharge");
        playSound("olympusCharge", soundEnabled);
        await wait(turbo ? 170 : 470);

        setPhase("stormHit");
        setFlashKey((value) => value + 1);
        playSound("olympusHit", soundEnabled);
        await wait(turbo ? 55 : 140);

        setPhase("stormImpact");
        playSound("olympusMultiplier", soundEnabled);
        await wait(turbo ? 35 : 80);
      }

      const targetTotal = displayedTotal + cascade.payout;
      const countDuration = turbo ? 120 : cascade.multiplier > 1 ? 500 : 300;
      setWinDuration(countDuration);
      setWin(targetTotal);
      await wait(countDuration);
      displayedTotal = targetTotal;

      setStormEnergy(cascade.stormEnergyAfter);
      if (isBonusRound && cascade.stormLevelAfter > cascade.stormLevel) {
        setStormLevel(cascade.stormLevelAfter);
        setLevelPulseKey((value) => value + 1);
        setPhase("levelUp");
        playOlympusLevelUp(cascade.stormLevelAfter, soundEnabled);
        await wait(turbo ? 150 : cascade.stormLevelAfter >= 4 ? 420 : 270);
      } else {
        setStormLevel(cascade.stormLevelAfter);
      }

      setWinning(new Set());
      setPhase("collapse");
      playSound("olympusFall", soundEnabled);
      await wait(turbo ? 80 : 190);
      setGrid(cascade.nextGrid);
      await wait(turbo ? 65 : 150);
    }

    setGrid(plan.finalGrid);
    setWinning(new Set());
    setStormMultiplier(1);
    setStormLevel(plan.stormLevelEnd);
    setStormEnergy(plan.stormEnergyEnd);
    setPhase(isBonusRound ? "bonusPlaying" : "settled");
    return displayedTotal;
  }, [revealInitialGrid, soundEnabled, turbo]);

  const presentFeature = useCallback(async (
    feature: OlympusFeaturePlan,
    source: Exclude<BonusSource, null>,
    displayedTotalStart: number,
  ) => {
    setBonusActive(true);
    setBonusSource(source);
    setBonusTotal(0);
    setStormLevel(1);
    setStormEnergy(0);
    setBonusIntroSpins(feature.initialSpins);
    setFreeSpinsLeft(feature.initialSpins);

    setPhase(source === "featureBuy" ? "featureCinematic" : "bonusTrigger");
    playSound(source === "featureBuy" ? "olympusFeatureOpen" : "olympusBonusIntro", soundEnabled);
    await wait(turbo ? 260 : source === "featureBuy" ? 850 : 620);

    setPhase("bonusIntro");
    setFlashKey((value) => value + 1);
    playSound("olympusBonusIntro", soundEnabled);
    await wait(turbo ? 260 : 760);

    let displayedTotal = displayedTotalStart;
    setPhase("bonusPlaying");

    for (const spin of feature.spins) {
      setFreeSpinsLeft(spin.spinsRemainingBefore);
      setStormLevel(spin.round.stormLevelStart);
      setStormEnergy(spin.round.stormEnergyStart);
      displayedTotal = await presentRound(spin.round, displayedTotal, true);
      setFreeSpinsLeft(spin.spinsRemainingAfter);

      if (spin.retriggerAward > 0) {
        setRetriggerAward(spin.retriggerAward);
        setPhase("retrigger");
        playSound("olympusRetrigger", soundEnabled);
        await wait(turbo ? 210 : 620);
        setRetriggerAward(0);
        setPhase("bonusPlaying");
      }
    }

    setBonusTotal(feature.payout);
    setPhase("bonusOutro");
    playSound(feature.payout >= feature.initialSpins * bet * 2 ? "olympusBigWin" : "olympusBonusEnd", soundEnabled);
    await wait(turbo ? 320 : 900);

    setBonusActive(false);
    setBonusSource(null);
    setFreeSpinsLeft(0);
    setStormLevel(1);
    setStormEnergy(0);
    setPhase("settled");
    return displayedTotal;
  }, [bet, presentRound, soundEnabled, turbo]);

  const settlePaidRound = useCallback((plan: OlympusRoundPlan, totalPayout: number, feature?: OlympusFeaturePlan) => {
    if (totalPayout > 0) arcadeActions.credit(totalPayout);
    arcadeActions.recordRound({
      slug: "olympus-storm",
      gameName: "Olympus Storm",
      bet,
      payout: totalPayout,
      multiplier: totalPayout > 0 ? totalPayout / bet : 0,
      note: feature
        ? `Storm Ascension · natural · ${feature.finalSpins} Free Spins · Storm L${feature.finalStormLevel}`
        : `${plan.cascades.length} cascata(s) · ${plan.stormHits} tempestade(s)`,
    });
  }, [bet]);

  const spinRound = useCallback(async (): Promise<boolean> => {
    if (busyRef.current || bonusActive || featureModalOpen || featurePending) return false;
    if (!arcadeActions.placeBet(bet)) {
      playSound("lose", soundEnabled);
      return false;
    }

    busyRef.current = true;
    setRoundBusy(true);
    setWin(0);
    setWinDuration(0);
    setStormLevel(1);
    setStormEnergy(0);

    // Resultado base é fechado antes da animação. Se houver trigger, o plano completo
    // da feature é fechado antes da intro do bônus; a apresentação nunca decide payout.
    const plan = planOlympusRound(bet);
    let displayedTotal = await presentRound(plan, 0, false);
    let feature: OlympusFeaturePlan | undefined;

    if (plan.freeSpinsAward > 0) {
      feature = planOlympusFeature(bet, plan.freeSpinsAward);
      displayedTotal = await presentFeature(feature, "natural", displayedTotal);
    }

    const totalPayout = plan.payout + (feature?.payout ?? 0);
    setWin(displayedTotal);
    settlePaidRound(plan, totalPayout, feature);
    playSound(
      totalPayout >= bet * 15 ? "olympusBigWin" : totalPayout > 0 ? "win" : "lose",
      soundEnabled,
    );

    await wait(turbo ? 90 : 220);
    setPhase("idle");
    setRoundBusy(false);
    busyRef.current = false;
    return true;
  }, [bet, bonusActive, featureModalOpen, featurePending, presentFeature, presentRound, settlePaidRound, soundEnabled, turbo]);

  const startAuto = useCallback(async () => {
    if (busyRef.current || autoLeft > 0 || bonusActive || featureModalOpen || featurePending) return;
    autoStopRef.current = false;
    for (let left = 10; left > 0; left -= 1) {
      if (autoStopRef.current) break;
      setAutoLeft(left);
      const played = await spinRound();
      if (!played) break;
      await wait(turbo ? 100 : 260);
    }
    setAutoLeft(0);
  }, [autoLeft, bonusActive, featureModalOpen, featurePending, spinRound, turbo]);

  const openFeatureModal = () => {
    if (roundBusy || autoLeft > 0 || bonusActive || featurePending || featureModalOpen) return;
    setFeatureModalOpen(true);
    playSound("click", soundEnabled);
  };

  const activateFeatureBuy = useCallback(async () => {
    const lock = featureBuyLockRef.current;
    if (!lock.acquire()) return;

    const availability = olympusFeatureBuyAvailability({
      balance: arcadeActions.getBalance(),
      bet,
      spinning: busyRef.current,
      bonusActive,
      autoLeft,
      modalOpen: false,
      pending: featurePending,
    });

    if (!availability.allowed) {
      lock.release();
      playSound("lose", soundEnabled);
      return;
    }

    setFeaturePending(true);
    busyRef.current = true;
    setRoundBusy(true);
    setFeatureModalOpen(false);
    setWin(0);
    setWinDuration(0);

    try {
      if (!arcadeActions.debitCoins(availability.cost)) {
        playSound("lose", soundEnabled);
        return;
      }

      const feature = planOlympusFeature(bet, OLYMPUS_FEATURE_BUY_INITIAL_SPINS);
      const displayedTotal = await presentFeature(feature, "featureBuy", 0);
      setWin(displayedTotal);
      if (feature.payout > 0) arcadeActions.credit(feature.payout);
      arcadeActions.recordRound({
        slug: "olympus-storm",
        gameName: "Olympus Storm",
        bet: availability.cost,
        payout: feature.payout,
        multiplier: feature.payout > 0 ? feature.payout / availability.cost : 0,
        note: `Storm Ascension · Custo ${formatCoins(availability.cost)} · Aposta ${formatCoins(bet)} · ${feature.finalSpins} Free Spins · Storm L${feature.finalStormLevel}`,
      });
      playSound(feature.payout >= availability.cost * 2 ? "olympusBigWin" : feature.payout > 0 ? "win" : "lose", soundEnabled);
      await wait(turbo ? 90 : 220);
      setPhase("idle");
    } finally {
      setFeaturePending(false);
      setRoundBusy(false);
      busyRef.current = false;
      lock.release();
    }
  }, [autoLeft, bet, bonusActive, featurePending, presentFeature, soundEnabled, turbo]);

  const changeBet = (direction: -1 | 1) => {
    if (roundBusy || autoLeft > 0 || bonusActive || featureModalOpen) return;
    const current = Math.max(0, BET_STEPS.findIndex((value) => value === bet));
    const next = Math.max(0, Math.min(BET_STEPS.length - 1, current + direction));
    const value = BET_STEPS[next];
    if (value !== undefined) setBet(value);
  };

  const setMaxBet = () => {
    if (roundBusy || autoLeft > 0 || bonusActive || featureModalOpen) return;
    const affordable = [...BET_STEPS].reverse().find((value) => value <= balance);
    if (affordable !== undefined) setBet(affordable);
  };

  const featureCost = olympusFeatureBuyCost(bet);
  const insufficient = bet > balance;
  const featureInsufficient = featureCost > balance;
  const stormActive = phase === "stormCharge" || phase === "stormHit" || phase === "stormImpact" || phase === "levelUp";
  const anticipationActive = phase === "anticipation";
  const bonusVisualActive = bonusActive || phase === "bonusIntro" || phase === "featureCinematic" || phase === "bonusOutro";
  const cascadeEnergy = Math.min(4, cascadeNumber);
  const levelThreshold = stormLevel >= 5 ? 1 : (OLYMPUS_STORM_LEVEL_THRESHOLDS[stormLevel - 1] ?? 1);
  const energyPercent = stormLevel >= 5 ? 100 : Math.min(100, (stormEnergy / levelThreshold) * 100);
  const levelMultiplier = OLYMPUS_STORM_LEVEL_MULTIPLIERS[stormLevel - 1] ?? 1;
  const zeusState = phase === "stormHit"
    ? "strike"
    : phase === "stormImpact"
      ? "afterglow"
      : phase === "stormCharge" || anticipationActive
      ? "charge"
      : phase === "levelUp"
        ? "ascend"
        : bonusVisualActive || phase === "bonusPlaying" || phase === "retrigger"
          ? "bonus"
          : win >= bet * 15 && phase === "settled"
            ? "bigwin"
            : "idle";

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black sm:px-3 sm:py-2">
      <div
        className={cn(
          "os-ref-machine relative mx-auto aspect-[941/1672] w-full max-w-[430px] overflow-hidden bg-[#021329] shadow-[0_0_100px_rgba(20,106,255,.16)] sm:rounded-[22px]",
          `os-ref-energy-${cascadeEnergy}`,
          stormActive && "os-ref-machine--storm",
          anticipationActive && "os-ref-machine--anticipation",
          bonusVisualActive && "os-ref-machine--ascended",
          `os-ref-storm-level-${stormLevel}`,
        )}
        data-bonus-active={bonusActive ? "true" : "false"}
        data-phase={phase}
        data-zeus-state={zeusState}
        data-storm-multiplier={stormMultiplier}
      >
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

        <div className="os-ref-atmosphere pointer-events-none absolute inset-0 z-[13]" aria-hidden>
          <div className="os-ref-sky-depth" />
          <div className="os-ref-mid-mist" />
          <div className="os-ref-foreground-clouds" />
        </div>

        <div className={cn("os-ref-zeus-stage", `is-${zeusState}`)} aria-hidden>
          <div className="os-ref-zeus-rim" />
          <div className="os-ref-zeus-aura" />
          <div className="os-ref-zeus-bolt" />
        </div>

        <Link
          to="/"
          aria-label="Voltar ao lobby"
          className="absolute right-[1.8%] top-[1.2%] z-50 size-[9%] rounded-full bg-transparent"
        />

        <button
          type="button"
          data-testid="olympus-sound-toggle"
          onClick={() => {
            arcadeActions.toggleSound();
            playSound("click", !soundEnabled);
          }}
          aria-label={soundEnabled ? "Desativar som" : "Ativar som"}
          aria-pressed={soundEnabled}
          className="os-ref-control os-ref-sound-toggle absolute left-[2.2%] top-[1.45%] z-50 grid w-[9%] aspect-square place-items-center rounded-full"
        >
          {soundEnabled ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
        </button>

        {src && (
          <OlympusGrid
            grid={grid}
            src={src}
            winning={winning}
            phase={phase}
            revealedColumns={revealedColumns}
          />
        )}

        {flashKey > 0 && phase === "stormHit" && (
          <div key={flashKey} className="os-ref-lightning-flash pointer-events-none absolute z-40" aria-hidden />
        )}

        {(phase === "stormCharge" || phase === "stormImpact") && stormMultiplier > 1 && (
          <div className="os-ref-storm-message absolute left-1/2 top-[43%] z-[65] -translate-x-1/2 rounded-2xl border-2 border-cyan-100 bg-[#001d4d]/92 px-5 py-3 text-center font-serif text-3xl font-black text-white shadow-[0_0_38px_rgba(50,185,255,.95)]">
            {phase === "stormCharge" ? "STORM CHARGE" : `×${stormMultiplier}`}
          </div>
        )}

        {bonusActive && (
          <div className="os-storm-level-hud absolute left-[8%] top-[18.2%] z-[57] w-[84%]" key={`level-${stormLevel}-${levelPulseKey}`}>
            <div className="os-storm-hud-row">
              <span><small>FREE SPINS</small><strong>{freeSpinsLeft}</strong></span>
              <span><small>STORM LEVEL</small><strong>{stormLevel}</strong></span>
              <span><small>ENERGIA</small><strong>{Math.round(energyPercent)}%</strong></span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full border border-cyan-100/45 bg-[#00122d]/85">
              <div className="os-storm-energy-fill h-full rounded-full" style={{ width: `${energyPercent}%` }} />
            </div>
            <p className="os-storm-hud-multiplier">ASCENSION ×{levelMultiplier.toFixed(levelMultiplier % 1 === 0 ? 0 : 2)}</p>
          </div>
        )}

        {(phase === "featureCinematic" || phase === "bonusIntro" || phase === "bonusTrigger") && (
          <div className="os-ascension-intro pointer-events-none absolute inset-0 z-[80] grid place-items-center">
            {phase === "featureCinematic" && (
              <div className="os-buy-orbs" aria-hidden>
                <span /><span /><span />
              </div>
            )}
            <div className="os-ascension-title-card">
              <p className="text-[9px] font-black tracking-[.3em] text-cyan-100">OLYMPUS STORM</p>
              <h2>STORM ASCENSION</h2>
              <p>{bonusIntroSpins} FREE SPINS</p>
            </div>
          </div>
        )}

        {phase === "levelUp" && (
          <div className="os-level-up-toast pointer-events-none absolute left-1/2 top-[39%] z-[78] -translate-x-1/2 text-center">
            <span>STORM LEVEL</span>
            <strong>{stormLevel}</strong>
          </div>
        )}

        {phase === "retrigger" && retriggerAward > 0 && (
          <div className="os-retrigger-toast pointer-events-none absolute left-1/2 top-[41%] z-[78] -translate-x-1/2 text-center">
            <span>STORM REIGNITED</span>
            <strong>+{retriggerAward} FREE SPINS</strong>
          </div>
        )}

        {phase === "bonusOutro" && (
          <div className="os-bonus-total pointer-events-none absolute inset-0 z-[82] grid place-items-center">
            <div>
              <span>TOTAL DO BÔNUS</span>
              <strong><AnimatedWinCounter value={bonusTotal} duration={turbo ? 180 : 650} /></strong>
              <small>STORM LEVEL FINAL {stormLevel}</small>
            </div>
          </div>
        )}

        {win >= bet * 15 && phase === "settled" && !bonusActive && (
          <div className="os-ref-big-win pointer-events-none absolute left-1/2 top-[43%] z-[64] -translate-x-1/2 rounded-2xl border-2 border-yellow-100 bg-[#071b58]/94 px-5 py-3 text-center font-serif text-3xl font-black text-yellow-100 shadow-[0_0_42px_rgba(95,205,255,.82)]">
            BIG WIN
          </div>
        )}

        <div className="absolute left-[25.5%] top-[77.7%] z-35 flex h-[6.5%] w-[49%] items-center justify-center rounded-[18px] bg-[#002a62]/95 px-2 text-center shadow-[inset_0_0_12px_rgba(70,175,255,.45)]">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[.18em] text-blue-200">
              {bonusActive
                ? `STORM L${stormLevel} · ${freeSpinsLeft} FREE SPINS`
                : roundBusy && cascadeNumber > 0
                  ? `CASCADE ${cascadeNumber} · ${clusterCount} CLUSTER${clusterCount === 1 ? "" : "S"}`
                  : "WIN"}
            </p>
            <p className="font-serif text-[clamp(1.1rem,7vw,2rem)] font-black leading-none text-[#ffd95b] tabular-nums drop-shadow-[0_2px_0_#5b3100]">
              <AnimatedWinCounter value={win} duration={winDuration} />
            </p>
            {stormMultiplier > 1 && phase === "stormImpact" && (
              <p className="mt-0.5 text-[8px] font-black text-cyan-200">STORM ×{stormMultiplier}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          data-testid="olympus-feature-buy"
          onClick={openFeatureModal}
          disabled={roundBusy || autoLeft > 0 || bonusActive || featurePending || featureModalOpen || !src}
          aria-label="Abrir Storm Ascension"
          className="os-ref-control os-feature-buy-button absolute left-[3.1%] top-[78.25%] z-50 h-[5.25%] w-[20.5%] rounded-xl disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="os-feature-buy-icon" aria-hidden>ϟ</span>
          <span>BÔNUS</span>
        </button>

        <div className="absolute left-[3.2%] top-[85.1%] z-35 flex h-[4.2%] w-[27.5%] items-center justify-center rounded-lg bg-[#021b3a]/95 px-1 font-black text-white tabular-nums">
          {formatCoins(balance)}
        </div>
        <div className="absolute right-[3.1%] top-[85.1%] z-35 flex h-[4.2%] w-[23.5%] items-center justify-center rounded-lg bg-[#021b3a]/95 px-1 font-black text-white tabular-nums">
          {formatCoins(bet)}
        </div>

        <button
          type="button"
          onClick={() => changeBet(-1)}
          disabled={roundBusy || autoLeft > 0 || bonusActive || featureModalOpen}
          aria-label="Diminuir aposta"
          className="os-ref-control absolute right-[27.8%] top-[84.3%] z-50 w-[7%] aspect-square rounded-full disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() => changeBet(1)}
          disabled={roundBusy || autoLeft > 0 || bonusActive || featureModalOpen}
          aria-label="Aumentar aposta"
          className="os-ref-control absolute right-[1.2%] top-[84.3%] z-50 w-[7%] aspect-square rounded-full disabled:opacity-40"
        />

        <button
          type="button"
          onClick={() => setTurbo((value) => !value)}
          aria-label="Alternar turbo"
          aria-pressed={turbo}
          disabled={roundBusy || bonusActive || featureModalOpen}
          className={cn(
            "os-ref-control absolute right-[1.3%] top-[78.1%] z-50 w-[8.8%] aspect-square rounded-full disabled:opacity-50",
            turbo && "ring-2 ring-cyan-100 shadow-[0_0_25px_#45c8ff]",
          )}
        />

        {autoLeft > 0 ? (
          <button
            type="button"
            onClick={() => { autoStopRef.current = true; }}
            aria-label="Parar auto play"
            className="os-ref-control absolute left-[4.5%] top-[92.6%] z-50 h-[5.7%] w-[25%] rounded-xl"
          >
            <span className="absolute right-0 top-0 rounded-full bg-cyan-500 px-1.5 text-[9px] font-black text-white">{autoLeft}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startAuto()}
            disabled={roundBusy || insufficient || !src || bonusActive || featureModalOpen || featurePending}
            aria-label="Auto play"
            className="os-ref-control absolute left-[4.5%] top-[92.6%] z-50 h-[5.7%] w-[25%] rounded-xl disabled:opacity-40"
          />
        )}

        <button
          type="button"
          onClick={setMaxBet}
          disabled={roundBusy || autoLeft > 0 || bonusActive || featureModalOpen}
          aria-label="Aposta máxima"
          className="os-ref-control absolute right-[4.4%] top-[92.6%] z-50 h-[5.7%] w-[25.5%] rounded-xl disabled:opacity-40"
        />

        <button
          type="button"
          onClick={() => void spinRound()}
          disabled={roundBusy || autoLeft > 0 || insufficient || !src || bonusActive || featureModalOpen || featurePending}
          aria-label="Girar Olympus Storm"
          aria-busy={roundBusy}
          className={cn(
            "os-ref-spin-button absolute left-[35.5%] top-[81.2%] z-50 w-[29%] aspect-square overflow-hidden rounded-full disabled:cursor-not-allowed disabled:opacity-45",
            roundBusy && "scale-95",
          )}
        >
          <span className="os-ref-spin-glow" aria-hidden />
        </button>

        {featureModalOpen && (
          <div className="os-feature-modal absolute inset-0 z-[95] grid place-items-center" data-testid="olympus-feature-modal">
            <button
              type="button"
              className="absolute inset-0 bg-[#000b1d]/78 backdrop-blur-[2px]"
              aria-label="Fechar Storm Ascension"
              onClick={() => setFeatureModalOpen(false)}
            />
            <section className="os-feature-panel relative z-10 w-[88%] max-h-[72%] overflow-y-auto rounded-[22px] border border-[#ffe28a]/65 bg-[linear-gradient(155deg,#051a42_0%,#07143a_56%,#24184a_100%)] p-3 text-center text-white shadow-[0_22px_80px_rgba(0,0,0,.72),0_0_45px_rgba(71,190,255,.25)]">
              <div className="mx-auto mb-2 grid size-12 place-items-center rounded-full border border-[#ffe49d]/70 bg-[#0b2a62] text-3xl text-[#fff1a5] shadow-[0_0_28px_rgba(79,197,255,.45)]">ϟ</div>
              <p className="text-[9px] font-black tracking-[.28em] text-cyan-100">OLYMPUS STORM</p>
              <h2 className="mt-1 font-serif text-2xl font-black text-[#fff0a7]">STORM ASCENSION</h2>
              <p className="mt-1 font-black text-cyan-50">8 FREE SPINS</p>
              <div className="mx-auto mt-2 max-w-[18rem] space-y-1 text-left text-[10px] leading-relaxed text-blue-50/90">
                <p>• Storm Level persiste durante o bônus.</p>
                <p>• Cascatas carregam a tempestade.</p>
                <p>• Storm Hits aceleram a ascensão.</p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-left">
                <div className="rounded-xl border border-cyan-100/20 bg-black/25 p-2">
                  <span className="block text-[8px] font-black tracking-wider text-blue-200">APOSTA</span>
                  <strong className="text-sm text-white">{formatCoins(bet)}</strong>
                </div>
                <div className="rounded-xl border border-[#ffe28a]/25 bg-black/25 p-2">
                  <span className="block text-[8px] font-black tracking-wider text-[#ffe6a0]">CUSTO</span>
                  <strong className="text-sm text-[#fff3bd]">{formatCoins(featureCost)}</strong>
                </div>
              </div>
              <p className="mt-2 text-[8px] font-black tracking-[.16em] text-blue-100/70">MOEDAS FICTÍCIAS · SEM VALOR REAL</p>
              {featureInsufficient && (
                <p className="mt-2 rounded-lg border border-rose-200/35 bg-rose-950/35 px-2 py-1.5 text-[9px] font-bold text-rose-100">Saldo fictício insuficiente.</p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFeatureModalOpen(false)}
                  className="os-ref-control min-h-11 rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-[10px] font-black tracking-wider text-blue-50"
                >
                  CANCELAR
                </button>
                <button
                  type="button"
                  data-testid="olympus-feature-activate"
                  onClick={() => void activateFeatureBuy()}
                  disabled={featureInsufficient || featurePending}
                  className="os-ref-control min-h-11 rounded-xl border border-[#fff0ac]/65 bg-[linear-gradient(180deg,#ffe682,#b97a15)] px-3 py-2.5 text-[10px] font-black tracking-wider text-[#1d1606] shadow-[0_0_24px_rgba(255,209,86,.25)] disabled:opacity-40"
                >
                  ATIVAR
                </button>
              </div>
            </section>
          </div>
        )}

        {insufficient && !roundBusy && !featureModalOpen && (
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
