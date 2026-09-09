import { Link } from "@tanstack/react-router";
import { Volume2, VolumeX } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

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
import { playOlympusLevelUp, playSound, setAmbienceEnergy, setGameAmbience } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import { AnimatedWinCounter } from "./AnimatedWinCounter";

type Phase =
  | "idle"
  | "spin"
  | "landing"
  | "cluster"
  | "storm-charge"
  | "storm-impact"
  | "collapse"
  | "refill"
  | "bonus-intro"
  | "bonus"
  | "level-up"
  | "bonus-outro"
  | "settled";

type SymbolTone = "cyan" | "gold" | "violet" | "emerald" | "silver" | "azure" | "royal";

const OLYMPUS_ROWS = 5;
const BET_STEPS = [10, 50, 100, 200, 500, 1_000, 5_000, 10_000] as const;
const AUTO_OPTIONS = [10, 25, 50] as const;
const INITIAL_GRID: OlympusSymbolId[] = [
  "bolt", "crown", "chalice", "coin", "hammer", "orb",
  "coin", "hammer", "orb", "crown", "bolt", "chalice",
  "crown", "zeus", "bolt", "orb", "coin", "chalice",
  "hammer", "orb", "coin", "bolt", "crown", "zeus",
  "orb", "coin", "chalice", "hammer", "bolt", "crown",
];

const SYMBOL_TONE: Record<Exclude<OlympusSymbolId, "scatter">, SymbolTone> = {
  bolt: "cyan",
  crown: "gold",
  chalice: "violet",
  coin: "emerald",
  hammer: "silver",
  orb: "azure",
  zeus: "royal",
};

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, reducedMotion() ? 0 : ms));
}

const StormSymbol = memo(function StormSymbol({ id }: { id: OlympusSymbolId }) {
  if (id === "scatter") {
    return (
      <div className="osp-symbol osp-symbol--scatter" aria-label="Storm Orb">
        <span className="osp-scatter-ring" aria-hidden />
        <span className="osp-scatter-rune" aria-hidden>ϟ</span>
      </div>
    );
  }

  const tone = SYMBOL_TONE[id];
  return (
    <div className={cn("osp-symbol", `osp-symbol--${tone}`)} aria-label={id}>
      <svg viewBox="0 0 100 100" role="img" aria-hidden="true" className="osp-symbol-svg">
        {id === "bolt" && <path d="M58 5 24 55h22l-8 40 39-58H55L58 5Z" />}
        {id === "crown" && (
          <>
            <path d="M14 30 34 46 50 20l16 26 20-16-8 44H22l-8-44Z" />
            <rect x="24" y="70" width="52" height="10" rx="4" />
            <circle cx="50" cy="18" r="6" />
          </>
        )}
        {id === "chalice" && (
          <>
            <path d="M27 20h46v14c0 20-10 31-23 31S27 54 27 34V20Z" />
            <path d="M21 25H10c0 19 8 29 23 30M79 25h11c0 19-8 29-23 30" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
            <rect x="46" y="61" width="8" height="18" rx="3" />
            <rect x="34" y="77" width="32" height="9" rx="4" />
          </>
        )}
        {id === "coin" && (
          <>
            <circle cx="50" cy="50" r="34" />
            <circle cx="50" cy="50" r="23" fill="none" stroke="currentColor" strokeWidth="6" />
            <path d="M50 33v34M40 42h15c9 0 9 10 0 10H45c-9 0-9 10 0 10h15" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          </>
        )}
        {id === "hammer" && (
          <>
            <path d="m25 28 28-16 20 18-28 18-20-20Z" />
            <path d="m50 43 11-7 25 38-12 9-24-40Z" />
            <path d="m15 66 12-8 22 31H34L15 66Z" />
          </>
        )}
        {id === "orb" && (
          <>
            <circle cx="50" cy="45" r="28" />
            <path d="M30 76h40l9 12H21l9-12Z" />
            <path d="M37 39c5-10 19-15 29-8" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          </>
        )}
        {id === "zeus" && (
          <>
            <path d="M26 74c5-18 15-27 24-27s19 9 24 27l-8 12H34L26 74Z" />
            <circle cx="50" cy="31" r="17" />
            <path d="M33 33c6 0 8-6 9-13M67 33c-6 0-8-6-9-13M41 34c4 6 14 6 18 0" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            <path d="M46 48 37 69l13-8 13 8-9-21" />
          </>
        )}
      </svg>
      <span className="osp-symbol-shine" aria-hidden />
    </div>
  );
});

const StormGrid = memo(function StormGrid({
  grid,
  winning,
  phase,
  visibleColumns,
}: {
  grid: OlympusSymbolId[];
  winning: Set<number>;
  phase: Phase;
  visibleColumns: number;
}) {
  const moving = phase === "spin" || phase === "landing";
  return (
    <div className={cn("osp-grid", `is-${phase}`)} data-testid="olympus-grid">
      {grid.map((symbol, index) => {
        const column = index % OLYMPUS_COLUMNS;
        const rolling = moving && column >= visibleColumns;
        return (
          <div
            key={`${index}-${symbol}`}
            className={cn(
              "osp-cell",
              rolling && "is-rolling",
              winning.has(index) && "is-winning",
              winning.size > 0 && !winning.has(index) && "is-dim",
              symbol === "scatter" && "is-scatter",
            )}
          >
            <div className="osp-cell-inner"><StormSymbol id={symbol} /></div>
          </div>
        );
      })}
    </div>
  );
});

export function OlympusStormPremium() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);

  const [bet, setBet] = useState<number>(200);
  const [grid, setGrid] = useState<OlympusSymbolId[]>(INITIAL_GRID);
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [phase, setPhase] = useState<Phase>("idle");
  const [visibleColumns, setVisibleColumns] = useState(OLYMPUS_COLUMNS);
  const [win, setWin] = useState(0);
  const [winDuration, setWinDuration] = useState(0);
  const [stormMultiplier, setStormMultiplier] = useState(1);
  const [stormLevel, setStormLevel] = useState<OlympusStormLevel>(1);
  const [stormEnergy, setStormEnergy] = useState(0);
  const [cascadeNumber, setCascadeNumber] = useState(0);
  const [bonusActive, setBonusActive] = useState(false);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0);
  const [bonusTotal, setBonusTotal] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [featureOpen, setFeatureOpen] = useState(false);

  const busyRef = useRef(false);
  const autoStopRef = useRef(false);

  useEffect(() => {
    hydrateFromStorage();
    return () => { autoStopRef.current = true; };
  }, []);
  useEffect(() => {
    setGameAmbience("olympus", soundEnabled);
    return () => setGameAmbience("olympus", false);
  }, [soundEnabled]);
  useEffect(() => {
    const charged = phase === "storm-charge" || phase === "storm-impact" || phase === "level-up";
    setAmbienceEnergy(charged ? 1.42 : bonusActive ? 1.18 : busyRef.current ? 1 : .72);
  }, [bonusActive, phase]);

  const revealGrid = useCallback(async (plan: OlympusRoundPlan, compact: boolean) => {
    setPhase("spin");
    setVisibleColumns(0);
    setWinning(new Set());
    playSound(compact ? "olympusBonusSpin" : "olympusSpin", soundEnabled);
    await wait(turbo ? 110 : compact ? 210 : 350);

    for (let column = 0; column < OLYMPUS_COLUMNS; column += 1) {
      setGrid((current) => current.map((symbol, index) => (
        index % OLYMPUS_COLUMNS === column ? (plan.initialGrid[index] ?? symbol) : symbol
      )));
      setVisibleColumns(column + 1);
      setPhase("landing");
      const scatterLanded = plan.initialGrid.some((symbol, index) => symbol === "scatter" && index % OLYMPUS_COLUMNS === column);
      playSound(scatterLanded ? "olympusScatter" : "tick", soundEnabled);
      await wait(turbo ? 55 : compact ? 90 : 130);
      if (column < OLYMPUS_COLUMNS - 1) setPhase("spin");
    }
  }, [soundEnabled, turbo]);

  const presentRound = useCallback(async (plan: OlympusRoundPlan, startTotal: number, bonusRound: boolean) => {
    setCascadeNumber(0);
    setStormMultiplier(1);
    await revealGrid(plan, bonusRound);
    let displayed = startTotal;

    for (let index = 0; index < plan.cascades.length; index += 1) {
      const cascade = plan.cascades[index];
      if (!cascade) continue;
      setGrid(cascade.grid);
      setWinning(new Set(cascade.winning));
      setCascadeNumber(index + 1);
      setStormLevel(cascade.stormLevel);
      setStormEnergy(cascade.stormEnergyBefore);
      setPhase("cluster");
      playSound("olympusCluster", soundEnabled, { intensity: Math.min(1.1, .84 + index * .06) });
      await wait(turbo ? 90 : bonusRound ? 180 : 260);

      if (cascade.multiplier > 1) {
        setStormMultiplier(cascade.multiplier);
        setPhase("storm-charge");
        playSound("olympusCharge", soundEnabled, { intensity: Math.min(1.12, .9 + cascade.multiplier / 180) });
        await wait(turbo ? 90 : 230);
        setPhase("storm-impact");
        playSound("olympusHit", soundEnabled, { intensity: 1.08 });
        await wait(turbo ? 70 : 155);
      }

      displayed += cascade.payout;
      setWinDuration(turbo ? 100 : cascade.multiplier > 1 ? 420 : 240);
      setWin(displayed);
      playSound("cash", soundEnabled);
      await wait(turbo ? 85 : 190);

      setStormEnergy(cascade.stormEnergyAfter);
      if (bonusRound && cascade.stormLevelAfter > cascade.stormLevel) {
        setStormLevel(cascade.stormLevelAfter);
        setPhase("level-up");
        playOlympusLevelUp(cascade.stormLevelAfter, soundEnabled);
        await wait(turbo ? 100 : 260);
      } else {
        setStormLevel(cascade.stormLevelAfter);
      }

      setPhase("collapse");
      playSound("olympusFall", soundEnabled);
      await wait(turbo ? 75 : 155);
      setGrid(cascade.nextGrid);
      setWinning(new Set());
      setPhase("refill");
      await wait(turbo ? 75 : 170);
    }

    setGrid(plan.finalGrid);
    setWinning(new Set());
    setVisibleColumns(OLYMPUS_COLUMNS);
    setStormMultiplier(1);
    setStormLevel(plan.stormLevelEnd);
    setStormEnergy(plan.stormEnergyEnd);
    setPhase(bonusRound ? "bonus" : "settled");
    return displayed;
  }, [revealGrid, soundEnabled, turbo]);

  const presentFeature = useCallback(async (feature: OlympusFeaturePlan, startTotal: number) => {
    setBonusActive(true);
    setBonusTotal(0);
    setStormLevel(1);
    setStormEnergy(0);
    setFreeSpinsLeft(feature.initialSpins);
    setPhase("bonus-intro");
    playSound("olympusBonusIntro", soundEnabled);
    await wait(turbo ? 180 : 520);

    let displayed = startTotal;
    for (const spin of feature.spins) {
      setFreeSpinsLeft(spin.spinsRemainingBefore);
      setStormLevel(spin.round.stormLevelStart);
      setStormEnergy(spin.round.stormEnergyStart);
      displayed = await presentRound(spin.round, displayed, true);
      setFreeSpinsLeft(spin.spinsRemainingAfter);
      if (spin.retriggerAward > 0) {
        playSound("olympusRetrigger", soundEnabled);
        await wait(turbo ? 110 : 260);
      }
    }

    setBonusTotal(feature.payout);
    setPhase("bonus-outro");
    playSound(feature.payout >= feature.initialSpins * bet * 2 ? "olympusBigWin" : "olympusBonusEnd", soundEnabled);
    await wait(turbo ? 220 : 720);
    setBonusActive(false);
    setFreeSpinsLeft(0);
    setStormLevel(1);
    setStormEnergy(0);
    setPhase("settled");
    return displayed;
  }, [bet, presentRound, soundEnabled, turbo]);

  const spinRound = useCallback(async () => {
    if (busyRef.current || featureOpen) return false;
    if (!arcadeActions.placeBet(bet)) {
      playSound("lose", soundEnabled);
      return false;
    }

    busyRef.current = true;
    setWin(0);
    setWinDuration(0);
    setStormLevel(1);
    setStormEnergy(0);
    try {
      const plan = planOlympusRound(bet);
      let displayed = await presentRound(plan, 0, false);
      let feature: OlympusFeaturePlan | undefined;
      if (plan.freeSpinsAward > 0) {
        feature = planOlympusFeature(bet, plan.freeSpinsAward);
        displayed = await presentFeature(feature, displayed);
      }
      const total = plan.payout + (feature?.payout ?? 0);
      if (total > 0) arcadeActions.credit(total);
      arcadeActions.recordRound({
        slug: "olympus-storm",
        gameName: "Olympus Storm",
        bet,
        payout: total,
        multiplier: total > 0 ? total / bet : 0,
        note: feature
          ? `Storm Ascension · ${feature.finalSpins} Free Spins · Storm L${feature.finalStormLevel}`
          : `${plan.cascades.length} cascata(s) · ${plan.stormHits} tempestade(s)`,
      });
      setWin(displayed);
      if (total >= bet * 15) playSound("olympusBigWin", soundEnabled);
      else if (total <= 0) playSound("lose", soundEnabled);
      await wait(turbo ? 70 : 180);
      setPhase("idle");
      return true;
    } finally {
      busyRef.current = false;
    }
  }, [bet, featureOpen, presentFeature, presentRound, soundEnabled, turbo]);

  const buyFeature = useCallback(async () => {
    if (busyRef.current || autoLeft > 0) return;
    const cost = olympusFeatureBuyCost(bet);
    if (cost > arcadeActions.getBalance() || !arcadeActions.debitCoins(cost)) {
      playSound("lose", soundEnabled);
      return;
    }
    busyRef.current = true;
    setFeatureOpen(false);
    setWin(0);
    try {
      const feature = planOlympusFeature(bet, OLYMPUS_FEATURE_BUY_INITIAL_SPINS);
      const displayed = await presentFeature(feature, 0);
      if (feature.payout > 0) arcadeActions.credit(feature.payout);
      arcadeActions.recordRound({
        slug: "olympus-storm",
        gameName: "Olympus Storm",
        bet: cost,
        payout: feature.payout,
        multiplier: feature.payout > 0 ? feature.payout / cost : 0,
        note: `Storm Ascension · Custo ${formatCoins(cost)} · ${feature.finalSpins} Free Spins · Storm L${feature.finalStormLevel}`,
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
      await wait(turbo ? 80 : 180);
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

  const levelThreshold = stormLevel >= 5 ? 1 : (OLYMPUS_STORM_LEVEL_THRESHOLDS[stormLevel - 1] ?? 1);
  const energyPercent = stormLevel >= 5 ? 100 : Math.min(100, (stormEnergy / levelThreshold) * 100);
  const levelMultiplier = OLYMPUS_STORM_LEVEL_MULTIPLIERS[stormLevel - 1] ?? 1;
  const busy = busyRef.current || phase !== "idle" && phase !== "settled";
  const featureCost = olympusFeatureBuyCost(bet);
  const bigWin = win >= bet * 15 && phase === "settled" && !bonusActive;

  return (
    <main className="osp-page">
      <section
        className={cn("osp-machine", bonusActive && "is-bonus", phase === "storm-charge" && "is-charged", phase === "storm-impact" && "is-impact")}
        data-phase={phase}
        data-storm-level={stormLevel}
      >
        <div className="osp-sky" aria-hidden><i /><i /><i /></div>
        <div className="osp-temple" aria-hidden><span /><span /><span /><span /></div>
        <div className="osp-guardian" aria-hidden>
          <div className="osp-guardian-aura" />
          <div className="osp-guardian-crest">ϟ</div>
          <div className="osp-guardian-label">STORM ASCENSION</div>
        </div>

        <header className="osp-topbar">
          <button
            type="button"
            className="osp-icon-button"
            aria-label={soundEnabled ? "Desativar som" : "Ativar som"}
            onClick={() => {
              arcadeActions.toggleSound();
              playSound("click", !soundEnabled);
            }}
          >
            {soundEnabled ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
          </button>
          <div className="osp-brand"><small>NEON FORTUNE</small><strong>OLYMPUS STORM</strong></div>
          <Link to="/" className="osp-icon-button osp-back" aria-label="Voltar ao lobby">‹</Link>
        </header>

        <div className="osp-stage-hud">
          <div><small>STORM LEVEL</small><strong>{stormLevel}</strong></div>
          <div className="osp-energy"><span style={{ width: `${energyPercent}%` }} /></div>
          <div><small>ASCENSION</small><strong>×{levelMultiplier.toFixed(levelMultiplier % 1 === 0 ? 0 : 2)}</strong></div>
        </div>

        <StormGrid grid={grid} winning={winning} phase={phase} visibleColumns={visibleColumns} />

        {(phase === "storm-charge" || phase === "storm-impact") && stormMultiplier > 1 && (
          <div className={cn("osp-storm-callout", phase === "storm-impact" && "is-impact")}>
            <small>{phase === "storm-charge" ? "STORM CHARGE" : "STORM HIT"}</small>
            <strong>×{stormMultiplier}</strong>
          </div>
        )}
        {phase === "storm-impact" && <div className="osp-lightning" aria-hidden />}

        {phase === "level-up" && (
          <div className="osp-level-up"><small>STORM LEVEL</small><strong>{stormLevel}</strong></div>
        )}

        {phase === "bonus-intro" && (
          <div className="osp-cinematic">
            <div><small>THE SKY AWAKENS</small><strong>STORM ASCENSION</strong><span>{freeSpinsLeft} FREE SPINS</span></div>
          </div>
        )}

        {phase === "bonus-outro" && (
          <div className="osp-cinematic osp-cinematic--outro">
            <div><small>TOTAL DO BÔNUS</small><strong><AnimatedWinCounter value={bonusTotal} duration={turbo ? 160 : 620} /></strong><span>STORM LEVEL {stormLevel}</span></div>
          </div>
        )}

        {bigWin && (
          <div className="osp-big-win"><small>THUNDER PAYOUT</small><strong>BIG WIN</strong><span><AnimatedWinCounter value={win} duration={turbo ? 160 : 620} /></span></div>
        )}

        <div className="osp-status">
          <small>{bonusActive ? `${freeSpinsLeft} FREE SPINS · STORM L${stormLevel}` : cascadeNumber > 0 && busy ? `CASCADE ${cascadeNumber}` : "WIN"}</small>
          <strong><AnimatedWinCounter value={win} duration={winDuration} /></strong>
        </div>

        <div className="osp-economy">
          <div><small>SALDO</small><strong>{formatCoins(balance)}</strong></div>
          <button type="button" onClick={() => setFeatureOpen(true)} disabled={busy || autoLeft > 0} className="osp-bonus-button">BÔNUS</button>
          <div><small>APOSTA</small><strong>{formatCoins(bet)}</strong></div>
        </div>

        <div className="osp-controls">
          <button type="button" className={cn("osp-control", turbo && "is-active")} aria-pressed={turbo} onClick={() => setTurbo((value) => !value)} disabled={busy || autoLeft > 0}>TURBO</button>
          <button type="button" className="osp-control osp-step" onClick={() => changeBet(-1)} disabled={busy || autoLeft > 0}>−</button>
          <button type="button" className="osp-spin" data-testid="olympus-spin" onClick={() => void spinRound()} disabled={busy || autoLeft > 0 || bet > balance}><span>{autoLeft > 0 ? autoLeft : "ϟ"}</span></button>
          <button type="button" className="osp-control osp-step" onClick={() => changeBet(1)} disabled={busy || autoLeft > 0}>+</button>
          <button
            type="button"
            className={cn("osp-control", autoLeft > 0 && "is-active")}
            onClick={() => {
              if (autoLeft > 0) autoStopRef.current = true;
              else setAutoOpen(true);
            }}
            disabled={busy && autoLeft === 0}
          >AUTO</button>
        </div>

        <footer>MOEDAS FICTÍCIAS · SEM VALOR REAL</footer>

        {autoOpen && (
          <div className="osp-modal" role="dialog" aria-modal="true" aria-label="Configurar auto play">
            <button type="button" className="osp-modal-backdrop" aria-label="Fechar" onClick={() => setAutoOpen(false)} />
            <section className="osp-panel"><small>AUTO PLAY</small><h2>Escolha as rodadas</h2><div className="osp-auto-options">{AUTO_OPTIONS.map((rounds) => <button key={rounds} type="button" onClick={() => void startAuto(rounds)}>{rounds}</button>)}</div></section>
          </div>
        )}

        {featureOpen && (
          <div className="osp-modal" role="dialog" aria-modal="true" aria-label="Storm Ascension">
            <button type="button" className="osp-modal-backdrop" aria-label="Fechar" onClick={() => setFeatureOpen(false)} />
            <section className="osp-panel osp-feature-panel">
              <div className="osp-feature-orb">ϟ</div>
              <small>OLYMPUS STORM</small>
              <h2>STORM ASCENSION</h2>
              <p>{OLYMPUS_FEATURE_BUY_INITIAL_SPINS} Free Spins com Storm Level persistente.</p>
              <div className="osp-price"><span>APOSTA <b>{formatCoins(bet)}</b></span><span>CUSTO <b>{formatCoins(featureCost)}</b></span></div>
              <div className="osp-panel-actions"><button type="button" onClick={() => setFeatureOpen(false)}>CANCELAR</button><button type="button" onClick={() => void buyFeature()} disabled={featureCost > balance}>ATIVAR</button></div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
