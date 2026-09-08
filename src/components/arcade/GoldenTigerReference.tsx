import { Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles, Volume2, VolumeX, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { AnimatedWinCounter } from "./AnimatedWinCounter";
import { GoldenTigerSymbol } from "./golden-tiger/GoldenTigerSymbols";
import { GoldenTigerTigerStage, type TigerReactionState } from "./golden-tiger/GoldenTigerTigerStage";
import { formatCoins } from "@/lib/arcade/format";
import {
  evaluateGoldenTiger,
  goldenTigerWinTier,
  makeGoldenTigerGrid,
  type GoldenTigerSymbolId,
} from "@/lib/arcade/goldenTigerMath";
import {
  HOLD_WIN_FULL_GRID_BONUS,
  HOLD_WIN_INITIAL_RESPINS,
  holdWinFeatureBuyCost as holdWinActivationCost,
  rollBaseGoldCoinGrid,
  rollGoldCoinValue,
  runHoldWinFeature,
  type GoldCoinValue,
  type HoldWinCoin,
  type HoldWinResult,
} from "@/lib/arcade/goldenTigerHoldWin";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";
import "./GoldenTigerReference.css";

const BETS = [10, 20, 50, 100, 200, 500, 1_000] as const;
const INITIAL_GRID: GoldenTigerSymbolId[] = ["fortuneBag", "ingot", "jade", "orange", "wild", "firecracker", "lion", "lantern", "fortuneBag"];
const REEL_STRIP: readonly GoldenTigerSymbolId[] = ["orange", "jade", "firecracker", "fortuneBag", "ingot", "lantern", "lion", "wild"];
const CELL_INDEXES = Array.from({ length: 9 }, (_, index) => index);

type Phase = "idle" | "base-spin" | "feature-intro" | "feature-spin" | "coin-lock" | "feature-miss" | "win" | "full-grid";

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion() ? 24 : ms));
}

function mapCoins(coins: readonly HoldWinCoin[]) {
  return new Map<number, GoldCoinValue>(coins.map((coin) => [coin.index, coin.value]));
}

function mapFeatureGrid(grid: HoldWinResult["finalGrid"]) {
  const values = new Map<number, GoldCoinValue>();
  for (const cell of grid) if (cell.locked && cell.value !== null) values.set(cell.index, cell.value);
  return values;
}

function GoldCoin({ value, fresh }: { value: GoldCoinValue; fresh: boolean }) {
  return (
    <div className={cn("gt-hw-coin", fresh && "is-fresh", value >= 20 && "is-premium")}>
      <span className="gt-hw-coin-ring" aria-hidden />
      <span className="gt-hw-coin-mark" aria-hidden>✦</span>
      <strong>{value}×</strong>
      <small>APOSTA</small>
    </div>
  );
}

function ReelOverlay({ column, turbo }: { column: number; turbo: boolean }) {
  const symbols = [...REEL_STRIP, ...REEL_STRIP, ...REEL_STRIP];
  return (
    <div className="gt-hw-reel-overlay" style={{ left: `${column * 33.333333}%`, "--gt-reel-speed": `${turbo ? 300 : 520 + column * 45}ms` } as CSSProperties} aria-hidden>
      <div className="gt-hw-reel-track">
        {symbols.map((symbol, index) => <div className="gt-hw-reel-item" key={`${column}-${index}`}><GoldenTigerSymbol id={symbol} /></div>)}
      </div>
      <span className="gt-hw-reel-shade" />
    </div>
  );
}

function CellMotion({ index }: { index: number }) {
  const symbols = [REEL_STRIP[index % 8] ?? "orange", REEL_STRIP[(index + 3) % 8] ?? "jade", REEL_STRIP[(index + 5) % 8] ?? "ingot"];
  return <div className="gt-hw-cell-motion" aria-hidden><div>{symbols.map((symbol, item) => <span key={`${index}-${item}`}><GoldenTigerSymbol id={symbol} /></span>)}</div></div>;
}

export function GoldenTigerReference() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const [bet, setBet] = useState<number>(20);
  const [grid, setGrid] = useState<GoldenTigerSymbolId[]>(INITIAL_GRID);
  const [coins, setCoins] = useState<Map<number, GoldCoinValue>>(() => new Map());
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [freshCoins, setFreshCoins] = useState<Set<number>>(() => new Set());
  const [rollingCells, setRollingCells] = useState<Set<number>>(() => new Set());
  const [stoppedColumns, setStoppedColumns] = useState(3);
  const [phase, setPhase] = useState<Phase>("idle");
  const [featureActive, setFeatureActive] = useState(false);
  const [respinsRemaining, setRespinsRemaining] = useState(HOLD_WIN_INITIAL_RESPINS);
  const [win, setWin] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [autoRounds, setAutoRounds] = useState(10);
  const [autoOpen, setAutoOpen] = useState(false);
  const [featureOpen, setFeatureOpen] = useState(false);
  const busyRef = useRef(false);
  const autoStopRef = useRef(false);

  useEffect(() => {
    hydrateFromStorage();
    return () => { autoStopRef.current = true; };
  }, []);

  const activationCost = useMemo(() => holdWinActivationCost(bet), [bet]);
  const isBusy = phase !== "idle";
  const lockedCount = coins.size;
  const tigerReaction: TigerReactionState = phase === "full-grid" ? "full" : phase === "coin-lock" ? "coin" : phase === "feature-spin" && respinsRemaining <= 1 ? "tense" : phase === "base-spin" || phase === "feature-spin" || phase === "feature-intro" ? "watch" : phase === "win" ? "win" : "idle";

  const animateFeature = useCallback(async (plan: HoldWinResult, initialCoins: readonly HoldWinCoin[]) => {
    let visibleCoins = mapCoins(initialCoins);
    setCoins(new Map(visibleCoins));
    setFreshCoins(new Set(initialCoins.map((coin) => coin.index)));
    setFeatureActive(true);
    setRespinsRemaining(HOLD_WIN_INITIAL_RESPINS);
    setPhase("feature-intro");
    playSound("tigerLuckyFeature", soundEnabled);
    await wait(turbo ? 180 : 520);
    setFreshCoins(new Set());

    for (const step of plan.steps) {
      setRollingCells(new Set(CELL_INDEXES.filter((index) => !visibleCoins.has(index))));
      setPhase("feature-spin");
      playSound("tigerRespinRoll", soundEnabled);
      await wait(turbo ? 170 : 440);

      const nextCoins = mapFeatureGrid(step.grid);
      setCoins(new Map(nextCoins));
      setRespinsRemaining(step.respinsRemaining);
      setFreshCoins(new Set(step.addedIndices));
      await wait(turbo ? 20 : 55);
      setRollingCells(new Set());

      if (step.addedIndices.length > 0) {
        setPhase("coin-lock");
        playSound("tigerSymbolLock", soundEnabled);
        const premium = step.addedIndices.some((index) => (nextCoins.get(index) ?? 0) >= 20);
        if (premium) playSound("tigerImpact", soundEnabled);
        await wait(turbo ? 170 : premium ? 620 : 360);
      } else {
        setPhase("feature-miss");
        playSound("tigerMiss", soundEnabled);
        if (step.respinsRemaining === 1) playSound("anticipation", soundEnabled);
        await wait(turbo ? 95 : step.respinsRemaining === 1 ? 330 : 210);
      }
      visibleCoins = nextCoins;
      setFreshCoins(new Set());
      if (step.isFullGrid) break;
    }

    setCoins(mapFeatureGrid(plan.finalGrid));
    setRollingCells(new Set());
    return plan.payout;
  }, [soundEnabled, turbo]);

  const settle = useCallback(async (payout: number, stake: number, note: string, fullGrid: boolean) => {
    if (payout > 0) arcadeActions.credit(payout);
    arcadeActions.recordRound({ slug: "golden-tiger", gameName: "Golden Tiger", bet: stake, payout, multiplier: stake > 0 && payout > 0 ? payout / stake : 0, note });
    setWin(payout);
    if (fullGrid) {
      setPhase("full-grid");
      playSound("tigerFullGrid", soundEnabled);
      await wait(turbo ? 650 : 1900);
    } else if (payout > 0) {
      setPhase("win");
      const tier = goldenTigerWinTier(payout, stake);
      playSound(tier === "big" || tier === "mega" ? "bigWin" : "win", soundEnabled);
      await wait(turbo ? 260 : tier === "big" || tier === "mega" ? 1200 : 650);
    } else {
      playSound("lose", soundEnabled);
      await wait(turbo ? 70 : 160);
    }
  }, [soundEnabled, turbo]);

  const runSpin = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    if (!arcadeActions.placeBet(bet)) {
      busyRef.current = false;
      playSound("lose", soundEnabled);
      return false;
    }

    try {
      setWin(0); setWinning(new Set()); setFreshCoins(new Set()); setRollingCells(new Set()); setFeatureActive(false); setRespinsRemaining(3); setStoppedColumns(0); setPhase("base-spin");
      const nextGrid = makeGoldenTigerGrid(Math.random);
      const initialCoins = rollBaseGoldCoinGrid(Math.random);
      const baseResult = evaluateGoldenTiger(nextGrid, bet, new Set(initialCoins.map((coin) => coin.index)));
      const featurePlan = initialCoins.length > 0 ? runHoldWinFeature(bet, Math.random, initialCoins) : null;
      setGrid(nextGrid);
      setCoins(mapCoins(initialCoins));
      playSound("spin", soundEnabled);
      await wait(turbo ? 160 : 430);

      for (let column = 0; column < 3; column += 1) {
        const landingCoins = initialCoins.filter((coin) => coin.index % 3 === column);
        if (landingCoins.length) setFreshCoins(new Set(landingCoins.map((coin) => coin.index)));
        setStoppedColumns(column + 1);
        playSound("tick", soundEnabled);
        if (landingCoins.length) playSound("tigerSymbolLock", soundEnabled);
        await wait(turbo ? 80 : landingCoins.some((coin) => coin.value >= 20) ? 330 : 180);
      }
      setWinning(baseResult.winning);
      setFreshCoins(new Set());

      let featurePayout = 0;
      let fullGrid = false;
      if (featurePlan) {
        await wait(turbo ? 80 : 210);
        featurePayout = await animateFeature(featurePlan, initialCoins);
        fullGrid = featurePlan.isFullGrid;
      }
      const total = baseResult.payout + featurePayout;
      await settle(total, bet, featurePlan ? `3×3 · ${baseResult.lines} linha(s) · Hold & Win ${featurePlan.totalCoins}/9${fullGrid ? ` · GRID CHEIO ×${HOLD_WIN_FULL_GRID_BONUS}` : ""}` : `3×3 · ${baseResult.lines} linha(s)`, fullGrid);
      return true;
    } finally {
      setPhase("idle"); setFeatureActive(false); setRollingCells(new Set()); setFreshCoins(new Set()); setStoppedColumns(3); busyRef.current = false;
    }
  }, [animateFeature, bet, settle, soundEnabled, turbo]);

  const activateFeature = useCallback(async () => {
    if (busyRef.current || autoLeft > 0) return;
    busyRef.current = true;
    setFeatureOpen(false);
    if (!arcadeActions.debitCoins(activationCost)) {
      busyRef.current = false;
      playSound("lose", soundEnabled);
      return;
    }
    try {
      setWin(0); setWinning(new Set()); setStoppedColumns(3);
      const entry: HoldWinCoin[] = [{ index: Math.floor(Math.random() * 9), value: rollGoldCoinValue(Math.random) }];
      const plan = runHoldWinFeature(bet, Math.random, entry);
      setGrid(makeGoldenTigerGrid(Math.random));
      setCoins(mapCoins(entry));
      setFreshCoins(new Set(entry.map((coin) => coin.index)));
      playSound("tigerFeatureOpen", soundEnabled);
      await wait(turbo ? 160 : 420);
      const payout = await animateFeature(plan, entry);
      await settle(payout, activationCost, `Golden Fortune · Hold & Win ${plan.totalCoins}/9${plan.isFullGrid ? ` · GRID CHEIO ×${HOLD_WIN_FULL_GRID_BONUS}` : ""}`, plan.isFullGrid);
    } finally {
      setPhase("idle"); setFeatureActive(false); setRollingCells(new Set()); setFreshCoins(new Set()); busyRef.current = false;
    }
  }, [activationCost, animateFeature, autoLeft, bet, settle, soundEnabled, turbo]);

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
    playSound("click", soundEnabled);
  };

  const status = phase === "feature-intro" ? "HOLD & WIN ATIVADO" : phase === "feature-spin" ? (respinsRemaining === 1 ? "ÚLTIMA CHANCE..." : "PROCURE NOVAS MOEDAS") : phase === "coin-lock" ? "MOEDA TRAVADA · RESPINS VOLTAM PARA 3" : phase === "feature-miss" ? `${respinsRemaining} RESPIN${respinsRemaining === 1 ? "" : "S"} RESTANTE${respinsRemaining === 1 ? "" : "S"}` : phase === "full-grid" ? `GRID CHEIO · ×${HOLD_WIN_FULL_GRID_BONUS}` : phase === "win" ? `GANHO ${formatCoins(win)}` : "MOEDA DOURADA ATIVA O HOLD & WIN";

  return (
    <main className="gt-hw-page">
      <section className="gt-hw-machine" data-phase={phase} aria-label="Golden Tiger">
        <div className="gt-hw-backdrop" aria-hidden />
        <div className="gt-hw-ambient" aria-hidden>{Array.from({ length: 14 }, (_, index) => <i key={index} />)}</div>
        <header className="gt-hw-topbar">
          <Link to="/" className="gt-hw-icon-button" onClick={() => { autoStopRef.current = true; }} aria-label="Voltar ao cassino"><ArrowLeft /></Link>
          <div className="gt-hw-brand"><small>NEON FORTUNE ARCADE</small><h1>GOLDEN TIGER</h1><span>HOLD & WIN</span></div>
          <button className="gt-hw-icon-button" type="button" onClick={() => arcadeActions.toggleSound()} aria-label={soundEnabled ? "Desativar som" : "Ativar som"}>{soundEnabled ? <Volume2 /> : <VolumeX />}</button>
        </header>

        <GoldenTigerTigerStage reaction={tigerReaction} featureActive={featureActive} lockedCount={lockedCount} />
        <div className={cn("gt-hw-respin-panel", featureActive && "is-active", phase === "coin-lock" && "is-reset")}>
          <span>{featureActive ? "RESPINS" : "PRÊMIO MÁXIMO"}</span><strong>{featureActive ? respinsRemaining : `GRID ×${HOLD_WIN_FULL_GRID_BONUS}`}</strong><small>{featureActive ? `${lockedCount}/9 MOEDAS` : "CRÉDITOS FICTÍCIOS"}</small>
        </div>

        <div className="gt-hw-grid" aria-label="Grade de símbolos 3 por 3">
          {grid.map((symbol, index) => {
            const coin = coins.get(index);
            return <div className={cn("gt-hw-cell", winning.has(index) && coin === undefined && "is-winning", coin !== undefined && "is-locked", freshCoins.has(index) && "is-fresh")} key={index}>
              {coin !== undefined ? <GoldCoin value={coin} fresh={freshCoins.has(index)} /> : <GoldenTigerSymbol id={symbol} isWinning={winning.has(index)} />}
              {rollingCells.has(index) && <CellMotion index={index} />}
            </div>;
          })}
          {phase === "base-spin" && [0, 1, 2].filter((column) => column >= stoppedColumns).map((column) => <ReelOverlay column={column} turbo={turbo} key={column} />)}
          <span className="gt-hw-grid-glass" aria-hidden />
        </div>

        <div className="gt-hw-status" role="status" aria-live="polite"><Sparkles aria-hidden /><span>{status}</span></div>
        <div className="gt-hw-hud"><div><span>SALDO</span><strong>{formatCoins(balance)}</strong></div><div><span>APOSTA</span><strong>{formatCoins(bet)}</strong></div><div><span>GANHO</span><strong>{formatCoins(win)}</strong></div></div>

        <div className="gt-hw-controls">
          <button type="button" className="gt-hw-feature" onClick={() => setFeatureOpen(true)} disabled={isBusy || autoLeft > 0 || balance < activationCost}><span>GOLDEN FORTUNE</span><strong>{formatCoins(activationCost)}</strong></button>
          <div className="gt-hw-main-controls">
            <button type="button" onClick={() => changeBet(-1)} disabled={isBusy || autoLeft > 0} aria-label="Diminuir aposta">−</button>
            <button type="button" className="gt-hw-spin" onClick={() => void runSpin()} disabled={isBusy || autoLeft > 0 || balance < bet} aria-label="Girar"><span /></button>
            <button type="button" onClick={() => changeBet(1)} disabled={isBusy || autoLeft > 0} aria-label="Aumentar aposta">+</button>
          </div>
          <div className="gt-hw-secondary-controls">
            <button type="button" className={cn(turbo && "is-active")} onClick={() => setTurbo((value) => !value)} disabled={isBusy || autoLeft > 0} aria-pressed={turbo}><Zap /><span>TURBO</span></button>
            <button type="button" onClick={() => setBet(BETS[BETS.length - 1] ?? bet)} disabled={isBusy || autoLeft > 0}><strong>MAX</strong><span>APOSTA</span></button>
            {autoLeft > 0 ? <button type="button" className="is-active" onClick={() => { autoStopRef.current = true; }}><strong>{autoLeft}</strong><span>PARAR</span></button> : <button type="button" onClick={() => setAutoOpen(true)} disabled={isBusy || balance < bet}><strong>A</strong><span>AUTO</span></button>}
          </div>
        </div>
        <p className="gt-hw-fictional">ENTRETENIMENTO · CRÉDITOS 100% FICTÍCIOS · SEM VALOR MONETÁRIO</p>

        {(phase === "win" || phase === "full-grid") && win > 0 && <div className={cn("gt-hw-win-overlay", phase === "full-grid" && "is-full")}><div className="gt-hw-win-rays" aria-hidden /><span>{phase === "full-grid" ? "GRID CHEIO" : "GRANDE GANHO"}</span><AnimatedWinCounter value={win} duration={reducedMotion() ? 0 : phase === "full-grid" ? 1500 : 800} />{phase === "full-grid" && <small>VALOR DAS MOEDAS × {HOLD_WIN_FULL_GRID_BONUS}</small>}</div>}

        {autoOpen && <div className="gt-hw-modal" role="dialog" aria-modal="true" aria-label="Configurar Auto Play"><div><span>AUTO PLAY</span><h2>ESCOLHA AS RODADAS</h2><p>{formatCoins(bet)} créditos fictícios por rodada</p><nav>{[10, 25, 50, 100].map((rounds) => <button key={rounds} type="button" className={autoRounds === rounds ? "is-active" : ""} onClick={() => setAutoRounds(rounds)}>{rounds}</button>)}</nav><footer><button type="button" onClick={() => setAutoOpen(false)}>CANCELAR</button><button type="button" onClick={() => void startAuto()}>INICIAR</button></footer></div></div>}
        {featureOpen && <div className="gt-hw-modal" role="dialog" aria-modal="true" aria-label="Ativar Golden Fortune"><div><span>GOLDEN FORTUNE</span><h2>ENTRADA DIRETA NO HOLD & WIN</h2><p>Custo: {formatCoins(activationCost)} créditos fictícios. Começa com 3 respins e os respins não geram novos débitos.</p><footer><button type="button" onClick={() => setFeatureOpen(false)}>CANCELAR</button><button type="button" onClick={() => void activateFeature()} disabled={balance < activationCost}>ATIVAR</button></footer></div></div>}
      </section>
    </main>
  );
}
