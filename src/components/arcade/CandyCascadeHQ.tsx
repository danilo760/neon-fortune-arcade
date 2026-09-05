import { Link } from "@tanstack/react-router";
import { Sparkles, Volume2, VolumeX } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AnimatedWinCounter } from "./AnimatedWinCounter";
import candyReference from "@/assets/candy-cascade/reference-hd.webp";
import {
  candyFeatureBuyAvailability,
  candyFeatureBuyCost,
  createCandyFeaturePurchaseLock,
} from "@/lib/arcade/candyCascadeFeatureBuy";
import {
  CANDY_FEATURE_BUY_INITIAL_SPINS,
  CANDY_SUGAR_LEVEL_THRESHOLDS,
  makeCandyGrid,
  planCandyFeature,
  planCandyRound,
  type CandyBombEvent,
  type CandyFeaturePlan,
  type CandyRegularSymbolId,
  type CandyRoundPlan,
  type CandySymbolId,
} from "@/lib/arcade/candyCascadeMath";
import { playCandyFeatureSound } from "@/lib/arcade/candySound";
import { formatCoins } from "@/lib/arcade/format";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import "./CandyCascadeReference.css";

type Crop = { x: number; y: number; w: number; h: number };
type Phase =
  | "idle"
  | "spinning"
  | "anticipation"
  | "cluster"
  | "bombBirth"
  | "bombBurst"
  | "falling"
  | "bonusTrigger"
  | "featureCinematic"
  | "bonusIntro"
  | "bonusPlaying"
  | "retrigger"
  | "bonusOutro"
  | "settled";

type FeatureOverlay = {
  title: string;
  value?: string;
  caption?: string;
  tone: "trigger" | "retrigger" | "outro";
} | null;

const FULL_W = 600;
const FULL_H = 1066;
const COLS = 6;
const ROWS = 5;
const BET_STEPS = [10, 50, 100, 200, 500, 1_000, 5_000, 10_000] as const;

// SSR and hydration must paint the same cabinet. This display-only grid never
// participates in a result; the first paid spin still uses injected/random RNG.
const INITIAL_DISPLAY_GRID: readonly CandySymbolId[] = [
  "lollipop", "star", "jelly", "candy", "cupcake", "heart",
  "sprinkle", "diamond", "star", "lollipop", "jelly", "candy",
  "cupcake", "heart", "sprinkle", "diamond", "candy", "star",
  "jelly", "lollipop", "heart", "cupcake", "diamond", "sprinkle",
  "star", "candy", "lollipop", "jelly", "cupcake", "heart",
];

const CROPS: Record<CandyRegularSymbolId, Crop> = {
  lollipop: { x: 24, y: 281, w: 93, h: 87 },
  star: { x: 118, y: 281, w: 93, h: 87 },
  jelly: { x: 212, y: 281, w: 92, h: 87 },
  candy: { x: 305, y: 281, w: 93, h: 87 },
  cupcake: { x: 399, y: 281, w: 92, h: 87 },
  heart: { x: 399, y: 369, w: 92, h: 87 },
  sprinkle: { x: 212, y: 457, w: 92, h: 87 },
  diamond: { x: 305, y: 457, w: 93, h: 87 },
};

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

const CandySymbol = memo(function CandySymbol({ id }: { id: CandySymbolId }) {
  if (id === "partyCandy") {
    return (
      <div className="cc-party-candy absolute inset-0" aria-label="Party Candy">
        <span className="cc-party-candy__halo" />
        <span className="cc-party-candy__gem"><Sparkles /></span>
        <span className="cc-party-candy__ribbon" />
      </div>
    );
  }

  const crop = CROPS[id];
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#480529]">
      <img
        src={candyReference}
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

const BombOnGrid = memo(function BombOnGrid({ bomb, phase }: { bomb: CandyBombEvent; phase: Phase }) {
  const row = Math.floor(bomb.index / COLS);
  const column = bomb.index % COLS;
  return (
    <div
      className={cn("cc-grid-bomb", phase === "bombBurst" && "is-bursting")}
      style={{ left: `${column * (100 / COLS)}%`, top: `${row * (100 / ROWS)}%` }}
      aria-hidden
    >
      <span className="cc-grid-bomb__core">×{bomb.multiplier}</span>
      <span className="cc-grid-bomb__sugar" />
    </div>
  );
});

const FeatureCinematic = memo(function FeatureCinematic() {
  return (
    <div className="cc-feature-cinematic" aria-hidden>
      <i className="cc-feature-cinematic__scatter cc-feature-cinematic__scatter--a" />
      <i className="cc-feature-cinematic__scatter cc-feature-cinematic__scatter--b" />
      <i className="cc-feature-cinematic__scatter cc-feature-cinematic__scatter--c" />
      <i className="cc-feature-cinematic__bomb" />
      <i className="cc-feature-cinematic__energy" />
    </div>
  );
});

export function CandyCascadeHQ() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const [bet, setBet] = useState<number>(200);
  const [grid, setGrid] = useState<CandySymbolId[]>(() => [...INITIAL_DISPLAY_GRID]);
  const [win, setWin] = useState(0);
  const [winDuration, setWinDuration] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [cascadeIndex, setCascadeIndex] = useState(0);
  const [sugarMultiplier, setSugarMultiplier] = useState(1);
  const [activeBomb, setActiveBomb] = useState<CandyBombEvent | null>(null);
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [bonusActive, setBonusActive] = useState(false);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0);
  const [sugarEnergy, setSugarEnergy] = useState(0);
  const [sugarLevel, setSugarLevel] = useState(1);
  const [bonusTotal, setBonusTotal] = useState(0);
  const [featureOverlay, setFeatureOverlay] = useState<FeatureOverlay>(null);
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [featurePending, setFeaturePending] = useState(false);
  const [featureError, setFeatureError] = useState<string | null>(null);

  const busyRef = useRef(false);
  const autoStopRef = useRef(false);
  const featureLockRef = useRef(createCandyFeaturePurchaseLock());

  useEffect(() => hydrateFromStorage(), []);

  const featureCost = candyFeatureBuyCost(bet);
  const featureInsufficient = balance < featureCost;
  const energyProgress = Math.min(100, (sugarEnergy / (CANDY_SUGAR_LEVEL_THRESHOLDS[4] ?? 10)) * 100);

  const presentRound = useCallback(
    async (plan: CandyRoundPlan, featureMode: boolean) => {
      setGrid(plan.initialGrid);
      setWinning(new Set());
      setCascadeIndex(0);
      setActiveBomb(null);
      setSugarMultiplier(1);
      setWinDuration(0);
      setWin(0);

      if (plan.scatterCount === 1) {
        playCandyFeatureSound("scatter", soundEnabled);
        await wait(turbo ? 45 : 110);
      } else if (plan.scatterCount >= 2) {
        setPhase("anticipation");
        playCandyFeatureSound("anticipation", soundEnabled);
        await wait(turbo ? 90 : 260);
      }

      let displayed = 0;
      for (let index = 0; index < plan.cascades.length; index += 1) {
        const cascade = plan.cascades[index];
        if (!cascade) continue;

        setGrid(cascade.grid);
        setCascadeIndex(index + 1);
        setWinning(new Set(cascade.winning));
        setPhase("cluster");
        playSound("candyPop", soundEnabled);
        await wait(turbo ? 95 : Math.min(260 + index * 35, 410));
        playSound("candyBreak", soundEnabled);

        if (cascade.bomb) {
          setActiveBomb(cascade.bomb);
          setPhase("bombBirth");
          playSound("candyBomb", soundEnabled);
          await wait(turbo ? 125 : 310);
          setSugarMultiplier(cascade.sugarMultiplier);

          if (featureMode) {
            const levelChanged = cascade.sugarLevelAfter > cascade.sugarLevelBefore;
            setSugarEnergy(cascade.sugarEnergyAfter);
            setSugarLevel(cascade.sugarLevelAfter);
            playCandyFeatureSound(levelChanged ? "levelUp" : "meter", soundEnabled);
          }

          setPhase("bombBurst");
          playSound("candyExplosion", soundEnabled);
          await wait(turbo ? 95 : 230);
        } else {
          setSugarMultiplier(cascade.sugarMultiplier);
          if (featureMode) {
            setSugarEnergy(cascade.sugarEnergyAfter);
            setSugarLevel(cascade.sugarLevelAfter);
          }
        }

        // The number appears only after the precomputed Bomb -> Meter -> Level sequence.
        const target = displayed + cascade.payout;
        const duration = turbo ? 90 : 280;
        setWinDuration(duration);
        setWin(target);
        await wait(duration);
        displayed = target;

        setWinning(new Set());
        setActiveBomb(null);
        setPhase("falling");
        setGrid(cascade.nextGrid);
        playSound(index >= 2 ? "candyStreak" : "candyBounce", soundEnabled);
        await wait(turbo ? 105 : 270);
      }

      setGrid(plan.finalGrid);
      setWinning(new Set());
      setActiveBomb(null);
      return plan.payout;
    },
    [soundEnabled, turbo],
  );

  const playFeature = useCallback(
    async (feature: CandyFeaturePlan, purchased: boolean) => {
      setBonusActive(true);
      setBonusTotal(0);
      setSugarEnergy(0);
      setSugarLevel(1);
      setFreeSpinsLeft(feature.initialSpins);
      setPhase("bonusIntro");
      setFeatureOverlay({ title: "SUGAR PARTY", value: `${feature.initialSpins} FREE SPINS`, caption: "Sugar Meter ativo", tone: "trigger" });
      playCandyFeatureSound("bonusIntro", soundEnabled);
      await wait(turbo ? 180 : 620);
      setFeatureOverlay(null);

      let accumulated = 0;
      for (const spin of feature.spins) {
        setPhase("bonusPlaying");
        setFreeSpinsLeft(Math.max(1, spin.spinsRemainingAfter + 1 - spin.retriggerAward));
        const spinPayout = await presentRound(spin.round, true);
        accumulated += spinPayout;
        setBonusTotal(accumulated);

        if (spin.retriggerAward > 0) {
          setFreeSpinsLeft(spin.spinsRemainingAfter);
          setPhase("retrigger");
          setFeatureOverlay({ title: "SUGAR PARTY RECARREGADA", value: `+${spin.retriggerAward} FREE SPINS`, caption: "Party Candy ativou o retrigger", tone: "retrigger" });
          playCandyFeatureSound("retrigger", soundEnabled);
          await wait(turbo ? 130 : 430);
          setFeatureOverlay(null);
        } else {
          setFreeSpinsLeft(spin.spinsRemainingAfter);
        }

        await wait(turbo ? 65 : 150);
      }

      setFreeSpinsLeft(0);
      setPhase("bonusOutro");
      setFeatureOverlay({ title: "TOTAL DO BÔNUS", value: formatCoins(feature.payout), caption: `SUGAR LEVEL FINAL ${feature.finalSugarLevel}`, tone: "outro" });
      playCandyFeatureSound("bonusEnd", soundEnabled);
      await wait(turbo ? 250 : 850);
      setFeatureOverlay(null);
      setBonusActive(false);
      setSugarEnergy(0);
      setSugarLevel(1);
      setSugarMultiplier(1);
      setPhase("settled");

      return { payout: feature.payout, purchased };
    },
    [presentRound, soundEnabled, turbo],
  );

  const spinRound = useCallback(async () => {
    if (busyRef.current || bonusActive || featurePending || featureModalOpen) return false;
    if (!arcadeActions.placeBet(bet)) {
      playSound("lose", soundEnabled);
      return false;
    }

    busyRef.current = true;
    setSpinning(true);
    setPhase("spinning");
    setWinning(new Set());
    setCascadeIndex(0);
    setSugarMultiplier(1);
    setActiveBomb(null);
    setWinDuration(0);
    setWin(0);
    playSound("spin", soundEnabled);

    // Both the paid round and any naturally triggered feature are closed before presentation.
    const plan = planCandyRound(bet, Math.random, "base");
    const naturalFeature = plan.scatterAward > 0 ? planCandyFeature(bet, plan.scatterAward) : null;

    // The result is already precomputed. Keep the existing grid mounted and let
    // .cc-grid.is-spinning animate it on the compositor instead of rebuilding
    // 30 React cells several times just to fake reel motion.
    await wait(turbo ? 190 : 470);
    setGrid(plan.initialGrid);
    await wait(turbo ? 55 : 140);

    const basePayout = await presentRound(plan, false);
    let featurePayout = 0;

    if (naturalFeature) {
      setPhase("bonusTrigger");
      setFeatureOverlay({ title: "SUGAR PARTY", value: `${plan.scatterAward} FREE SPINS`, caption: `${plan.scatterCount} Party Candies`, tone: "trigger" });
      playCandyFeatureSound("trigger", soundEnabled);
      await wait(turbo ? 150 : 480);
      setFeatureOverlay(null);
      featurePayout = (await playFeature(naturalFeature, false)).payout;
    }

    const payout = basePayout + featurePayout;
    if (payout > 0) arcadeActions.credit(payout);
    const finalSugar = plan.cascades.at(-1)?.sugarMultiplier ?? 1;
    arcadeActions.recordRound({
      slug: "candy-cascade",
      gameName: "Candy Cascade",
      bet,
      payout,
      multiplier: payout > 0 ? payout / bet : 0,
      note: naturalFeature
        ? `${plan.cascades.length} cascata(s) · Sugar Party natural · ${naturalFeature.finalSpins} FS · Sugar L${naturalFeature.finalSugarLevel}`
        : `${plan.cascades.length} cascata(s) · ${plan.bombs} Sugar Bomb(s) · sugar ×${finalSugar}`,
    });
    playSound(payout >= bet * 10 ? "bigWin" : payout > 0 ? "win" : "lose", soundEnabled);
    await wait(turbo ? 70 : 180);
    setPhase("idle");
    setSpinning(false);
    busyRef.current = false;
    return true;
  }, [bet, bonusActive, featureModalOpen, featurePending, playFeature, presentRound, soundEnabled, turbo]);

  const startAuto = useCallback(async () => {
    if (busyRef.current || autoLeft > 0 || bonusActive || featureModalOpen || featurePending) return;
    autoStopRef.current = false;
    for (let left = 10; left > 0; left -= 1) {
      if (autoStopRef.current) break;
      setAutoLeft(left);
      const played = await spinRound();
      if (!played) break;
      await wait(turbo ? 90 : 230);
    }
    setAutoLeft(0);
  }, [autoLeft, bonusActive, featureModalOpen, featurePending, spinRound, turbo]);

  const openFeatureModal = useCallback(() => {
    if (busyRef.current || spinning || bonusActive || autoLeft > 0 || featurePending) return;
    setFeatureError(null);
    setFeatureModalOpen(true);
    playCandyFeatureSound("featureOpen", soundEnabled);
  }, [autoLeft, bonusActive, featurePending, soundEnabled, spinning]);

  const confirmFeatureBuy = useCallback(async () => {
    if (!featureLockRef.current.acquire()) return;
    const availability = candyFeatureBuyAvailability({
      balance: arcadeActions.getBalance(),
      bet,
      spinning: spinning || busyRef.current,
      bonusActive,
      autoLeft,
      pending: featurePending,
      modalProcessing: false,
    });

    if (!availability.allowed) {
      setFeatureError(availability.reason === "insufficientBalance" ? "Saldo fictício insuficiente." : "A compra está temporariamente indisponível.");
      featureLockRef.current.release();
      return;
    }

    setFeaturePending(true);
    setFeatureError(null);
    busyRef.current = true;
    setSpinning(true);

    // Purchase outcome is fully planned before the single debit and cinematic.
    const feature = planCandyFeature(bet, CANDY_FEATURE_BUY_INITIAL_SPINS);
    const debited = arcadeActions.debitCoins(availability.cost);
    if (!debited) {
      setFeaturePending(false);
      setSpinning(false);
      busyRef.current = false;
      setFeatureError("Saldo fictício insuficiente.");
      featureLockRef.current.release();
      return;
    }

    try {
      setFeatureModalOpen(false);
      setPhase("featureCinematic");
      setFeatureOverlay({ title: "SUGAR PARTY", value: `${CANDY_FEATURE_BUY_INITIAL_SPINS} FREE SPINS`, caption: "Party Candy → Sugar Bomb → Sugar Meter", tone: "trigger" });
      playCandyFeatureSound("trigger", soundEnabled);
      await wait(turbo ? 190 : 650);
      setFeatureOverlay(null);

      const result = await playFeature(feature, true);
      if (result.payout > 0) arcadeActions.credit(result.payout);
      arcadeActions.recordRound({
        slug: "candy-cascade",
        gameName: "Candy Cascade",
        bet: availability.cost,
        payout: result.payout,
        multiplier: availability.cost > 0 ? result.payout / availability.cost : 0,
        note: `Sugar Party · Custo ${formatCoins(availability.cost)} · Resultado ${formatCoins(result.payout)} · ${feature.finalSpins} FS · Sugar L${feature.finalSugarLevel}`,
      });
    } finally {
      setFeaturePending(false);
      setSpinning(false);
      setPhase("idle");
      busyRef.current = false;
      featureLockRef.current.release();
    }
  }, [autoLeft, bet, bonusActive, featurePending, playFeature, soundEnabled, spinning, turbo]);

  const changeBet = (direction: -1 | 1) => {
    if (spinning || autoLeft > 0 || bonusActive || featureModalOpen || featurePending) return;
    const current = Math.max(0, BET_STEPS.findIndex((value) => value === bet));
    const next = Math.max(0, Math.min(BET_STEPS.length - 1, current + direction));
    const value = BET_STEPS[next];
    if (value !== undefined) setBet(value);
  };

  const setMaxBet = () => {
    if (spinning || autoLeft > 0 || bonusActive || featureModalOpen || featurePending) return;
    const affordable = [...BET_STEPS].reverse().find((value) => value <= balance);
    if (affordable !== undefined) setBet(affordable);
  };

  const insufficient = bet > balance;
  const featureButtonBlocked = spinning || autoLeft > 0 || bonusActive || featurePending || featureModalOpen;
  const featureAvailability = useMemo(
    () => candyFeatureBuyAvailability({ balance, bet, spinning, bonusActive, autoLeft, pending: featurePending }),
    [autoLeft, balance, bet, bonusActive, featurePending, spinning],
  );

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black sm:px-3 sm:py-2">
      <div className={cn(
        "cc-machine relative mx-auto aspect-[600/1066] w-full max-w-[430px] overflow-hidden bg-[#31001d] shadow-[0_0_120px_rgba(255,54,187,.3)] sm:rounded-[22px]",
        cascadeIndex >= 3 && spinning && "cc-machine--streak",
        bonusActive && "cc-machine--bonus",
      )}>
        <img src={candyReference} alt="Candy Cascade" draggable={false} className="absolute inset-0 size-full select-none object-fill" />
        <Link to="/" aria-label="Voltar ao lobby" className="absolute right-[1.1%] top-[.8%] z-50 size-[9.2%] rounded-full bg-transparent" />
        <button
          type="button"
          onClick={() => { arcadeActions.toggleSound(); playSound("click", !soundEnabled); }}
          aria-label={soundEnabled ? "Desativar som" : "Ativar som"}
          className="cc-sound-button absolute left-[1.4%] top-[1%] z-[55] grid size-[8.8%] place-items-center rounded-full"
        >
          {soundEnabled ? <Volume2 /> : <VolumeX />}
        </button>

        {bonusActive && (
          <section className="cc-sugar-meter" aria-label={`Sugar Meter nível ${sugarLevel}, ${freeSpinsLeft} Free Spins restantes`}>
            <div><small>SUGAR LEVEL</small><strong>{sugarLevel}</strong></div>
            <div className="cc-sugar-meter__bar"><i style={{ width: `${energyProgress}%` }} /></div>
            <div><strong>{freeSpinsLeft}</strong><small>FREE SPINS</small></div>
          </section>
        )}

        <div className={cn("cc-grid absolute left-[4%] top-[28.3%] z-20 grid h-[45.8%] w-[93.3%] grid-cols-6 grid-rows-5 overflow-hidden", phase === "spinning" && "is-spinning", phase === "falling" && "is-falling", phase === "bombBurst" && "is-bomb-impact", phase === "anticipation" && "is-anticipating")}>
          {grid.map((symbol, index) => (
            <div key={index} className={cn("cc-cell relative overflow-hidden border border-[#f7bd45]/55 bg-[#480529]", winning.has(index) && "cc-ref-win", winning.size > 0 && !winning.has(index) && "cc-cell--dim", ["lollipop", "jelly", "cupcake", "diamond"].includes(symbol) && "cc-cell--premium", symbol === "partyCandy" && "cc-cell--scatter")}>
              <CandySymbol id={symbol} />
            </div>
          ))}
          {activeBomb && <BombOnGrid bomb={activeBomb} phase={phase} />}
        </div>

        {phase === "featureCinematic" && <FeatureCinematic />}

        <div className={cn("absolute left-[25%] top-[76.4%] z-[35] flex h-[7.7%] w-[50%] items-center justify-center rounded-[20px] bg-[#4a075f]/96 text-center shadow-[inset_0_0_18px_rgba(255,85,238,.4)]", win > 0 && !spinning && "cc-ref-result-win")}>
          <div>
            <p className="text-[8px] font-black uppercase tracking-[.16em] text-pink-100">{bonusActive ? `SUGAR L${sugarLevel}` : spinning && cascadeIndex > 0 ? `CASCADE ${cascadeIndex}` : "WIN"}</p>
            <p className="font-serif text-[clamp(1.25rem,7vw,2.15rem)] font-black leading-none text-[#ffe35f] tabular-nums drop-shadow-[0_2px_0_#6b2b00]"><AnimatedWinCounter value={win} duration={winDuration} /></p>
            {(cascadeIndex > 0 || sugarMultiplier > 1) && <p className="mt-0.5 text-[8px] font-black text-pink-100">SUGAR ×{sugarMultiplier}{bonusActive ? ` · TOTAL ${formatCoins(bonusTotal)}` : ""}</p>}
          </div>
        </div>

        <button
          type="button"
          onClick={openFeatureModal}
          disabled={featureButtonBlocked}
          aria-label="Abrir Sugar Party Bonus Buy"
          className="cc-feature-button absolute left-[2.8%] top-[78%] z-50 flex h-[5.4%] w-[22%] items-center justify-center gap-1 rounded-xl disabled:opacity-40"
        >
          <Sparkles aria-hidden /><span>BÔNUS</span>
        </button>

        <div className="absolute left-[3%] top-[85.1%] z-[35] flex h-[5.5%] w-[31%] items-center justify-center rounded-xl bg-[#2b071f]/96 px-1 text-[clamp(.65rem,3vw,.95rem)] font-black text-white tabular-nums">{formatCoins(balance)}</div>
        <div className="absolute right-[3%] top-[85.1%] z-[35] flex h-[5.5%] w-[28%] items-center justify-center rounded-xl bg-[#2b071f]/96 px-1 text-[clamp(.65rem,3vw,.95rem)] font-black text-white tabular-nums">{formatCoins(bet)}</div>
        <button type="button" onClick={() => changeBet(-1)} disabled={spinning || autoLeft > 0 || bonusActive || featureModalOpen} aria-label="Diminuir aposta" className="absolute right-[29.8%] top-[87%] z-50 size-[6.4%] rounded-full disabled:opacity-40" />
        <button type="button" onClick={() => changeBet(1)} disabled={spinning || autoLeft > 0 || bonusActive || featureModalOpen} aria-label="Aumentar aposta" className="absolute right-[1.7%] top-[87%] z-50 size-[6.4%] rounded-full disabled:opacity-40" />
        <button type="button" onClick={() => void spinRound()} disabled={spinning || autoLeft > 0 || insufficient || bonusActive || featureModalOpen || featurePending} aria-label="Girar Candy Cascade" aria-busy={spinning} className={cn("absolute left-[34.5%] top-[84.1%] z-50 h-[15.1%] w-[31%] rounded-full disabled:cursor-not-allowed disabled:opacity-40", !spinning && !insufficient && "cc-ref-spin-ready")} />
        <button type="button" onClick={() => { if (autoLeft > 0) { autoStopRef.current = true; } else { void startAuto(); } }} disabled={bonusActive || featureModalOpen || featurePending} aria-label={autoLeft > 0 ? "Parar auto play" : "Auto play"} className="absolute left-[8%] top-[93.4%] z-50 h-[5.5%] w-[25%] rounded-xl disabled:opacity-40" />
        <button type="button" onClick={setMaxBet} disabled={spinning || autoLeft > 0 || bonusActive || featureModalOpen} aria-label="Aposta máxima" className="absolute right-[8%] top-[93.4%] z-50 h-[5.5%] w-[25%] rounded-xl disabled:opacity-40" />
        <button type="button" onClick={() => setTurbo((value) => !value)} disabled={bonusActive || featureModalOpen} aria-label={turbo ? "Desativar turbo" : "Ativar turbo"} aria-pressed={turbo} className={cn("absolute right-[1.8%] top-[77.4%] z-50 size-[8.5%] rounded-full disabled:opacity-40", turbo && "ring-2 ring-yellow-300 ring-offset-1 ring-offset-transparent")} />
        <button type="button" onClick={() => setShowInfo((value) => !value)} disabled={bonusActive || featureModalOpen} aria-label="Informações do jogo" className="absolute left-[25%] top-[78.2%] z-50 size-[7.2%] rounded-full disabled:opacity-40" />

        {featureOverlay && (
          <div className={cn("cc-feature-overlay", `cc-feature-overlay--${featureOverlay.tone}`)} role="status" aria-live="polite">
            <div>
              <span>{featureOverlay.title}</span>
              {phase === "bonusOutro" ? <strong><AnimatedWinCounter value={bonusTotal} duration={turbo ? 160 : 650} /></strong> : featureOverlay.value && <strong>{featureOverlay.value}</strong>}
              {featureOverlay.caption && <small>{featureOverlay.caption}</small>}
            </div>
          </div>
        )}

        {featureModalOpen && (
          <div className="cc-feature-modal" role="dialog" aria-modal="true" aria-labelledby="sugar-party-title" data-testid="candy-feature-modal">
            <button type="button" className="cc-feature-modal__backdrop" aria-label="Fechar Sugar Party" onClick={() => !featurePending && setFeatureModalOpen(false)} />
            <section className="cc-feature-modal__panel">
              <div className="cc-feature-modal__icon"><Sparkles /></div>
              <p className="cc-feature-modal__kicker">CANDY CASCADE</p>
              <h2 id="sugar-party-title">SUGAR PARTY</h2>
              <strong>{CANDY_FEATURE_BUY_INITIAL_SPINS} FREE SPINS</strong>
              <p>Sugar Bombs carregam o Sugar Meter. O Sugar Meter persiste durante todo o bônus.</p>
              <div className="cc-feature-modal__stats">
                <div><span>APOSTA</span><b>{formatCoins(bet)}</b></div>
                <div><span>CUSTO</span><b>{formatCoins(featureCost)}</b></div>
              </div>
              <small>MOEDAS FICTÍCIAS · SEM VALOR REAL</small>
              {featureInsufficient && <em role="alert">Saldo fictício insuficiente.</em>}
              {featureError && !featureInsufficient && <em role="alert">{featureError}</em>}
              <div className="cc-feature-modal__actions">
                <button type="button" onClick={() => setFeatureModalOpen(false)} disabled={featurePending}>CANCELAR</button>
                <button type="button" data-testid="candy-feature-activate" onClick={() => void confirmFeatureBuy()} disabled={!featureAvailability.allowed || featurePending}>ATIVAR</button>
              </div>
            </section>
          </div>
        )}

        {showInfo && (
          <div className="absolute inset-x-[8%] top-[18%] z-[90] rounded-3xl border border-pink-200/80 bg-[#4a075f]/95 p-4 text-center text-white shadow-[0_12px_60px_rgba(0,0,0,.6)] backdrop-blur">
            <p className="text-base font-black text-yellow-200">CANDY CASCADE</p>
            <p className="mt-1 text-xs leading-relaxed text-pink-50">Grade 6×5. Cinco ou mais doces conectados explodem. 3+ Party Candies ativam Sugar Party; Sugar Bombs alimentam o Sugar Meter durante os Free Spins.</p>
            <button type="button" onClick={() => setShowInfo(false)} className="mt-3 rounded-full border border-pink-100 px-4 py-1.5 text-xs font-black">FECHAR</button>
          </div>
        )}

        {autoLeft > 0 && <div className="absolute left-[26%] top-[94.2%] z-[60] grid size-[6%] place-items-center rounded-full bg-emerald-500 text-[9px] font-black text-white shadow-lg">{autoLeft}</div>}
        {insufficient && !bonusActive && !featureModalOpen && <div className="absolute inset-x-[9%] bottom-[9%] z-[80] rounded-full border border-yellow-300 bg-[#4d0732]/95 px-4 py-2 text-center text-[10px] font-black uppercase tracking-wider text-yellow-100">Saldo fictício insuficiente</div>}
      </div>
    </main>
  );
}
