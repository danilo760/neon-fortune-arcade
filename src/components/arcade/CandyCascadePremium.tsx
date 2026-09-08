import { Link } from "@tanstack/react-router";
import { Sparkles, Volume2, VolumeX } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { AnimatedWinCounter } from "./AnimatedWinCounter";
import { candyFeatureBuyCost } from "@/lib/arcade/candyCascadeFeatureBuy";
import {
  CANDY_COLUMNS,
  CANDY_FEATURE_BUY_INITIAL_SPINS,
  CANDY_SUGAR_LEVEL_MULTIPLIERS,
  CANDY_SUGAR_LEVEL_THRESHOLDS,
  planCandyFeature,
  planCandyRound,
  type CandyBombEvent,
  type CandyFeaturePlan,
  type CandyRoundPlan,
  type CandySymbolId,
} from "@/lib/arcade/candyCascadeMath";
import { playCandyFeatureSound } from "@/lib/arcade/candySound";
import { formatCoins } from "@/lib/arcade/format";
import { playSound, setAmbienceEnergy, setGameAmbience } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

type Phase =
  | "idle"
  | "spin"
  | "landing"
  | "anticipation"
  | "cluster"
  | "bomb-birth"
  | "bomb-burst"
  | "collapse"
  | "refill"
  | "bonus-intro"
  | "bonus"
  | "retrigger"
  | "bonus-outro"
  | "settled";

type Tone = "rose" | "gold" | "berry" | "cyan" | "cream" | "lime" | "ruby" | "violet";

const ROWS = 5;
const BET_STEPS = [10, 50, 100, 200, 500, 1_000, 5_000, 10_000] as const;
const AUTO_OPTIONS = [10, 25, 50] as const;
const INITIAL_GRID: CandySymbolId[] = [
  "lollipop", "star", "jelly", "candy", "cupcake", "heart",
  "sprinkle", "diamond", "star", "lollipop", "jelly", "candy",
  "cupcake", "heart", "sprinkle", "diamond", "candy", "star",
  "jelly", "lollipop", "heart", "cupcake", "diamond", "sprinkle",
  "star", "candy", "lollipop", "jelly", "cupcake", "heart",
];

const TONES: Record<Exclude<CandySymbolId, "partyCandy">, Tone> = {
  lollipop: "rose",
  star: "gold",
  jelly: "berry",
  candy: "cyan",
  cupcake: "cream",
  sprinkle: "lime",
  heart: "ruby",
  diamond: "violet",
};

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, reducedMotion() ? 0 : ms));
}

const CandyVector = memo(function CandyVector({ id }: { id: CandySymbolId }) {
  if (id === "partyCandy") {
    return (
      <div className="ccp-symbol ccp-symbol--party" aria-label="Party Candy">
        <span className="ccp-party-orbit" aria-hidden />
        <Sparkles className="ccp-party-spark" aria-hidden />
      </div>
    );
  }

  const tone = TONES[id];
  return (
    <div className={cn("ccp-symbol", `ccp-symbol--${tone}`)} aria-label={id}>
      <svg viewBox="0 0 100 100" className="ccp-symbol-svg" aria-hidden="true">
        {id === "lollipop" && (
          <>
            <circle cx="48" cy="39" r="27" />
            <path d="M31 38c4-16 29-19 36-5 7 15-13 27-25 18-10-8-2-20 9-19 11 1 13 15 4 20" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
            <path d="m55 62 19 31" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
          </>
        )}
        {id === "star" && <path d="M50 7 61 36l31 2-24 20 8 31-26-17-26 17 8-31L8 38l31-2L50 7Z" />}
        {id === "jelly" && (
          <>
            <path d="M21 43c0-20 13-31 29-31s29 11 29 31v27c0 10-7 18-17 18H38c-10 0-17-8-17-18V43Z" />
            <circle cx="39" cy="48" r="4" fill="#fff" /><circle cx="61" cy="48" r="4" fill="#fff" />
            <path d="M38 64c8 7 16 7 24 0" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
          </>
        )}
        {id === "candy" && (
          <>
            <rect x="28" y="31" width="44" height="38" rx="14" />
            <path d="m28 37-18-12 4 22-4 22 18-12M72 37l18-12-4 22 4 22-18-12" />
            <path d="M39 38 61 62M61 38 39 62" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".65" />
          </>
        )}
        {id === "cupcake" && (
          <>
            <path d="M28 49h44l-7 38H35l-7-38Z" />
            <path d="M25 48c0-11 7-18 16-18 3-11 18-15 26-7 8 0 14 6 14 14 0 8-6 12-13 12H25Z" />
            <circle cx="55" cy="18" r="8" />
          </>
        )}
        {id === "sprinkle" && (
          <>
            <circle cx="50" cy="50" r="34" />
            <circle cx="50" cy="50" r="17" fill="#07152a" />
            <path d="M28 31l8 7M59 25l-3 10M72 44l-9 4M36 68l-7 6M62 68l6 8" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
          </>
        )}
        {id === "heart" && <path d="M50 86 16 53C-2 33 13 10 33 17c8 3 13 10 17 17 4-7 9-14 17-17 20-7 35 16 17 36L50 86Z" />}
        {id === "diamond" && (
          <>
            <path d="M23 18h54l15 24-42 47L8 42l15-24Z" />
            <path d="m23 18 15 24L50 18l12 24 15-24M8 42h84M38 42l12 47 12-47" fill="none" stroke="#fff" strokeWidth="4" opacity=".55" />
          </>
        )}
      </svg>
      <span className="ccp-symbol-shine" aria-hidden />
    </div>
  );
});

const CandyGrid = memo(function CandyGrid({
  grid,
  winning,
  phase,
  visibleColumns,
  bomb,
}: {
  grid: CandySymbolId[];
  winning: Set<number>;
  phase: Phase;
  visibleColumns: number;
  bomb: CandyBombEvent | null;
}) {
  const moving = phase === "spin" || phase === "landing" || phase === "anticipation";
  return (
    <div className={cn("ccp-grid", `is-${phase}`)} data-testid="candy-premium-grid">
      {grid.map((symbol, index) => {
        const column = index % CANDY_COLUMNS;
        const rolling = moving && column >= visibleColumns;
        const bombHere = bomb?.index === index;
        return (
          <div
            key={`${index}-${symbol}`}
            className={cn(
              "ccp-cell",
              rolling && "is-rolling",
              winning.has(index) && "is-winning",
              winning.size > 0 && !winning.has(index) && "is-dim",
              symbol === "partyCandy" && "is-party",
            )}
          >
            <div className="ccp-cell-inner"><CandyVector id={symbol} /></div>
            {bombHere && (
              <div className={cn("ccp-bomb", phase === "bomb-burst" && "is-bursting")} aria-hidden>
                <span>×{bomb.multiplier}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

export function CandyCascadePremium() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);

  const [bet, setBet] = useState<number>(200);
  const [grid, setGrid] = useState<CandySymbolId[]>(INITIAL_GRID);
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [phase, setPhase] = useState<Phase>("idle");
  const [visibleColumns, setVisibleColumns] = useState(CANDY_COLUMNS);
  const [activeBomb, setActiveBomb] = useState<CandyBombEvent | null>(null);
  const [win, setWin] = useState(0);
  const [winDuration, setWinDuration] = useState(0);
  const [cascadeNumber, setCascadeNumber] = useState(0);
  const [sugarMultiplier, setSugarMultiplier] = useState(1);
  const [sugarEnergy, setSugarEnergy] = useState(0);
  const [sugarLevel, setSugarLevel] = useState(1);
  const [bonusActive, setBonusActive] = useState(false);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0);
  const [bonusTotal, setBonusTotal] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [featureOpen, setFeatureOpen] = useState(false);

  const busyRef = useRef(false);
  const autoStopRef = useRef(false);

  useEffect(() => hydrateFromStorage(), []);
  useEffect(() => {
    setGameAmbience("candy", soundEnabled);
    return () => setGameAmbience("candy", false);
  }, [soundEnabled]);
  useEffect(() => {
    const burst = phase === "bomb-birth" || phase === "bomb-burst" || phase === "bonus-intro";
    setAmbienceEnergy(burst ? 1.36 : bonusActive ? 1.18 : busyRef.current ? 1.02 : .74);
  }, [bonusActive, phase]);

  const revealGrid = useCallback(async (plan: CandyRoundPlan, compact: boolean) => {
    setGrid(plan.initialGrid);
    setVisibleColumns(0);
    setWinning(new Set());
    setActiveBomb(null);
    setPhase("spin");
    playSound(compact ? "candyBounce" : "spin", soundEnabled);
    await wait(turbo ? 100 : compact ? 180 : 320);

    let scatters = 0;
    for (let column = 0; column < CANDY_COLUMNS; column += 1) {
      setVisibleColumns(column + 1);
      setPhase("landing");
      const landed = plan.initialGrid.filter((symbol, index) => symbol === "partyCandy" && index % CANDY_COLUMNS === column).length;
      scatters += landed;
      playSound(landed > 0 ? "candyStreak" : "tick", soundEnabled);
      if (scatters >= 2 && column < CANDY_COLUMNS - 1) {
        setPhase("anticipation");
        playCandyFeatureSound("anticipation", soundEnabled);
        await wait(turbo ? 70 : 190);
      } else {
        await wait(turbo ? 48 : compact ? 78 : 115);
      }
      if (column < CANDY_COLUMNS - 1) setPhase("spin");
    }
  }, [soundEnabled, turbo]);

  const presentRound = useCallback(async (plan: CandyRoundPlan, startTotal: number, bonusRound: boolean) => {
    setCascadeNumber(0);
    setSugarMultiplier(1);
    await revealGrid(plan, bonusRound);
    let displayed = startTotal;

    for (let index = 0; index < plan.cascades.length; index += 1) {
      const cascade = plan.cascades[index];
      if (!cascade) continue;
      setGrid(cascade.grid);
      setWinning(new Set(cascade.winning));
      setCascadeNumber(index + 1);
      setSugarMultiplier(cascade.sugarMultiplier);
      setSugarEnergy(cascade.sugarEnergyBefore);
      setSugarLevel(cascade.sugarLevelBefore);
      setPhase("cluster");
      playSound("candyPop", soundEnabled, { intensity: Math.min(1.08, .8 + index * .055) });
      await wait(turbo ? 82 : bonusRound ? 160 : 235);

      if (cascade.bomb) {
        setActiveBomb(cascade.bomb);
        setPhase("bomb-birth");
        playSound("candyBomb", soundEnabled, { intensity: 1.04 });
        await wait(turbo ? 75 : 160);
        setSugarEnergy(cascade.sugarEnergyAfter);
        setSugarLevel(cascade.sugarLevelAfter);
        setPhase("bomb-burst");
        playSound("candyExplosion", soundEnabled, { intensity: 1.08 });
        playCandyFeatureSound("meter", soundEnabled);
        await wait(turbo ? 75 : 170);
      }

      displayed += cascade.payout;
      setWinDuration(turbo ? 90 : cascade.bomb ? 380 : 230);
      setWin(displayed);
      playSound("cash", soundEnabled);
      await wait(turbo ? 80 : 170);

      setPhase("collapse");
      await wait(turbo ? 70 : 145);
      setGrid(cascade.nextGrid);
      setWinning(new Set());
      setActiveBomb(null);
      setPhase("refill");
      playSound("candyBounce", soundEnabled);
      await wait(turbo ? 72 : 155);
    }

    setGrid(plan.finalGrid);
    setWinning(new Set());
    setActiveBomb(null);
    setVisibleColumns(CANDY_COLUMNS);
    setSugarEnergy(plan.finalSugarEnergy);
    setSugarLevel(plan.finalSugarLevel);
    setPhase(bonusRound ? "bonus" : "settled");
    return displayed;
  }, [revealGrid, soundEnabled, turbo]);

  const presentFeature = useCallback(async (feature: CandyFeaturePlan, startTotal: number) => {
    setBonusActive(true);
    setBonusTotal(0);
    setSugarEnergy(0);
    setSugarLevel(1);
    setFreeSpinsLeft(feature.initialSpins);
    setPhase("bonus-intro");
    playCandyFeatureSound("bonusIntro", soundEnabled);
    await wait(turbo ? 170 : 520);

    let displayed = startTotal;
    for (const spin of feature.spins) {
      setFreeSpinsLeft(spin.spinsRemainingAfter + 1);
      if (spin.round.cascades[0]) {
        setSugarEnergy(spin.round.cascades[0].sugarEnergyBefore);
        setSugarLevel(spin.round.cascades[0].sugarLevelBefore);
      }
      displayed = await presentRound(spin.round, displayed, true);
      setFreeSpinsLeft(spin.spinsRemainingAfter);
      if (spin.retriggerAward > 0) {
        setPhase("retrigger");
        playCandyFeatureSound("retrigger", soundEnabled);
        await wait(turbo ? 100 : 280);
        setPhase("bonus");
      }
    }

    setBonusTotal(feature.payout);
    setSugarLevel(feature.finalSugarLevel);
    setSugarEnergy(feature.finalSugarEnergy);
    setPhase("bonus-outro");
    playCandyFeatureSound("bonusEnd", soundEnabled);
    await wait(turbo ? 210 : 700);
    setBonusActive(false);
    setFreeSpinsLeft(0);
    setSugarLevel(1);
    setSugarEnergy(0);
    setPhase("settled");
    return displayed;
  }, [presentRound, soundEnabled, turbo]);

  const spinRound = useCallback(async () => {
    if (busyRef.current || featureOpen || autoOpen) return false;
    if (!arcadeActions.placeBet(bet)) {
      playSound("lose", soundEnabled);
      return false;
    }

    busyRef.current = true;
    setWin(0);
    setWinDuration(0);
    setSugarEnergy(0);
    setSugarLevel(1);
    try {
      const plan = planCandyRound(bet);
      let displayed = await presentRound(plan, 0, false);
      let feature: CandyFeaturePlan | undefined;
      if (plan.scatterAward > 0) {
        feature = planCandyFeature(bet, plan.scatterAward);
        displayed = await presentFeature(feature, displayed);
      }
      const total = plan.payout + (feature?.payout ?? 0);
      if (total > 0) arcadeActions.credit(total);
      arcadeActions.recordRound({
        slug: "candy-cascade",
        gameName: "Candy Cascade",
        bet,
        payout: total,
        multiplier: total > 0 ? total / bet : 0,
        note: feature
          ? `Sugar Party · ${feature.finalSpins} Free Spins · Sugar L${feature.finalSugarLevel}`
          : `${plan.cascades.length} cascata(s) · ${plan.bombs} Sugar Bomb(s)`,
      });
      setWin(displayed);
      if (total >= bet * 10) playSound("bigWin", soundEnabled);
      else if (total <= 0) playSound("lose", soundEnabled);
      await wait(turbo ? 70 : 180);
      setPhase("idle");
      return true;
    } finally {
      busyRef.current = false;
    }
  }, [autoOpen, bet, featureOpen, presentFeature, presentRound, soundEnabled, turbo]);

  const buyFeature = useCallback(async () => {
    if (busyRef.current || autoLeft > 0) return;
    const cost = candyFeatureBuyCost(bet);
    if (cost <= 0 || cost > arcadeActions.getBalance() || !arcadeActions.debitCoins(cost)) {
      playSound("lose", soundEnabled);
      return;
    }
    busyRef.current = true;
    setFeatureOpen(false);
    setWin(0);
    try {
      const feature = planCandyFeature(bet, CANDY_FEATURE_BUY_INITIAL_SPINS);
      const displayed = await presentFeature(feature, 0);
      if (feature.payout > 0) arcadeActions.credit(feature.payout);
      arcadeActions.recordRound({
        slug: "candy-cascade",
        gameName: "Candy Cascade",
        bet: cost,
        payout: feature.payout,
        multiplier: feature.payout > 0 ? feature.payout / cost : 0,
        note: `Sugar Party · Custo ${formatCoins(cost)} · ${feature.finalSpins} Free Spins · Sugar L${feature.finalSugarLevel}`,
      });
      setWin(displayed);
      setPhase("idle");
    } finally {
      busyRef.current = false;
    }
  }, [autoLeft, bet, presentFeature, soundEnabled]);

  const startAuto = useCallback(async (rounds: number) => {
    if (busyRef.current || autoLeft > 0) return;
    autoStopRef.current = false;
    setAutoOpen(false);
    for (let left = rounds; left > 0; left -= 1) {
      if (autoStopRef.current) break;
      setAutoLeft(left);
      const played = await spinRound();
      if (!played) break;
      await wait(turbo ? 75 : 170);
    }
    setAutoLeft(0);
  }, [autoLeft, spinRound, turbo]);

  const changeBet = (direction: -1 | 1) => {
    if (busyRef.current || autoLeft > 0) return;
    const current = Math.max(0, BET_STEPS.findIndex((value) => value === bet));
    const next = Math.max(0, Math.min(BET_STEPS.length - 1, current + direction));
    const value = BET_STEPS[next];
    if (value !== undefined) setBet(value);
  };

  const levelIndex = Math.max(0, Math.min(4, sugarLevel - 1));
  const levelMultiplier = CANDY_SUGAR_LEVEL_MULTIPLIERS[levelIndex] ?? 1;
  const nextThreshold = CANDY_SUGAR_LEVEL_THRESHOLDS[Math.min(4, sugarLevel)] ?? 4;
  const energyPercent = sugarLevel >= 5 ? 100 : Math.min(100, (sugarEnergy / Math.max(1, nextThreshold)) * 100);
  const busy = busyRef.current || !["idle", "settled"].includes(phase);
  const featureCost = candyFeatureBuyCost(bet);
  const bigWin = win >= bet * 10 && phase === "settled" && !bonusActive;

  return (
    <main className="ccp-page">
      <section className={cn("ccp-machine", bonusActive && "is-bonus", phase === "bomb-burst" && "is-impact")} data-phase={phase} data-sugar-level={sugarLevel}>
        <div className="ccp-sky" aria-hidden><i /><i /><i /></div>
        <div className="ccp-hills" aria-hidden><span /><span /><span /></div>

        <header className="ccp-topbar">
          <button
            type="button"
            className="ccp-icon-button"
            aria-label={soundEnabled ? "Desativar som" : "Ativar som"}
            onClick={() => { arcadeActions.toggleSound(); playSound("click", !soundEnabled); }}
          >
            {soundEnabled ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
          </button>
          <div className="ccp-brand"><small>NEON FORTUNE</small><strong>CANDY CASCADE</strong></div>
          <Link to="/" className="ccp-icon-button ccp-back" aria-label="Voltar ao lobby">‹</Link>
        </header>

        <div className="ccp-mascot" aria-hidden>
          <div className="ccp-mascot-aura" />
          <div className="ccp-mascot-core"><Sparkles /></div>
          <div className="ccp-mascot-ribbon" />
        </div>

        <div className="ccp-sugar-hud">
          <div><small>SUGAR LEVEL</small><strong>{sugarLevel}</strong></div>
          <div className="ccp-energy"><span style={{ width: `${energyPercent}%` }} /></div>
          <div><small>BOOST</small><strong>×{levelMultiplier.toFixed(levelMultiplier % 1 === 0 ? 0 : 2)}</strong></div>
        </div>

        <CandyGrid grid={grid} winning={winning} phase={phase} visibleColumns={visibleColumns} bomb={activeBomb} />

        {phase === "bonus-intro" && (
          <div className="ccp-cinematic"><div><small>SUGAR SKY OPENS</small><strong>SUGAR PARTY</strong><span>{freeSpinsLeft} FREE SPINS</span></div></div>
        )}
        {phase === "retrigger" && (
          <div className="ccp-callout"><small>PARTY EXTENDED</small><strong>+ FREE SPINS</strong></div>
        )}
        {phase === "bonus-outro" && (
          <div className="ccp-cinematic ccp-cinematic--outro"><div><small>TOTAL DO BÔNUS</small><strong><AnimatedWinCounter value={bonusTotal} duration={turbo ? 160 : 620} /></strong><span>SUGAR LEVEL {sugarLevel}</span></div></div>
        )}
        {bigWin && (
          <div className="ccp-big-win"><small>SUGAR RUSH</small><strong>BIG WIN</strong><span><AnimatedWinCounter value={win} duration={turbo ? 160 : 620} /></span></div>
        )}

        <div className="ccp-status">
          <small>{bonusActive ? `${freeSpinsLeft} FREE SPINS · SUGAR L${sugarLevel}` : cascadeNumber > 0 && busy ? `CASCATA ${cascadeNumber} · SUGAR ×${sugarMultiplier}` : "GANHO"}</small>
          <strong><AnimatedWinCounter value={win} duration={winDuration} /></strong>
        </div>

        <div className="ccp-economy">
          <div><small>SALDO</small><strong>{formatCoins(balance)}</strong></div>
          <button type="button" onClick={() => setFeatureOpen(true)} disabled={busy || autoLeft > 0} className="ccp-bonus-button"><Sparkles aria-hidden /> BÔNUS</button>
          <div><small>APOSTA</small><strong>{formatCoins(bet)}</strong></div>
        </div>

        <div className="ccp-controls">
          <button type="button" className={cn("ccp-control", turbo && "is-active")} aria-pressed={turbo} onClick={() => setTurbo((value) => !value)} disabled={busy || autoLeft > 0}>TURBO</button>
          <button type="button" className="ccp-control ccp-step" onClick={() => changeBet(-1)} disabled={busy || autoLeft > 0}>−</button>
          <button type="button" className="ccp-spin" data-testid="candy-premium-spin" aria-label="Girar Candy Cascade" onClick={() => void spinRound()} disabled={busy || autoLeft > 0 || bet > balance}><span>{autoLeft > 0 ? autoLeft : "★"}</span></button>
          <button type="button" className="ccp-control ccp-step" onClick={() => changeBet(1)} disabled={busy || autoLeft > 0}>+</button>
          <button
            type="button"
            className={cn("ccp-control", autoLeft > 0 && "is-active")}
            onClick={() => { if (autoLeft > 0) autoStopRef.current = true; else setAutoOpen(true); }}
            disabled={busy && autoLeft === 0}
          >AUTO</button>
        </div>

        <footer>MOEDAS FICTÍCIAS · SEM VALOR REAL</footer>

        {autoOpen && (
          <div className="ccp-modal" role="dialog" aria-modal="true" aria-label="Configurar auto play">
            <button type="button" className="ccp-modal-backdrop" aria-label="Fechar" onClick={() => setAutoOpen(false)} />
            <section className="ccp-panel"><small>AUTO PLAY</small><h2>Escolha as rodadas</h2><div className="ccp-auto-options">{AUTO_OPTIONS.map((rounds) => <button key={rounds} type="button" onClick={() => void startAuto(rounds)}>{rounds}</button>)}</div></section>
          </div>
        )}

        {featureOpen && (
          <div className="ccp-modal" role="dialog" aria-modal="true" aria-label="Sugar Party">
            <button type="button" className="ccp-modal-backdrop" aria-label="Fechar" onClick={() => setFeatureOpen(false)} />
            <section className="ccp-panel ccp-feature-panel">
              <div className="ccp-feature-orb"><Sparkles /></div>
              <small>CANDY CASCADE</small>
              <h2>SUGAR PARTY</h2>
              <p>{CANDY_FEATURE_BUY_INITIAL_SPINS} Free Spins com Sugar Meter persistente.</p>
              <div className="ccp-price"><span>APOSTA <b>{formatCoins(bet)}</b></span><span>CUSTO <b>{formatCoins(featureCost)}</b></span></div>
              <div className="ccp-panel-actions"><button type="button" onClick={() => setFeatureOpen(false)}>CANCELAR</button><button type="button" onClick={() => void buyFeature()} disabled={featureCost > balance}>ATIVAR</button></div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
