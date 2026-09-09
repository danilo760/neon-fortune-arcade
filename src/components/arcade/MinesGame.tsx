import { Bomb, Gem, Play, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import neonMinesReference from "@/assets/neon-mines-reference.webp";
import { Button } from "@/components/ui/button";
import { formatCoins, formatMultiplier } from "@/lib/arcade/format";
import { createMineField, minesMultiplier, nextMinesMultiplier } from "@/lib/arcade/mines";
import {
  clearMinesRoundSnapshot,
  loadMinesRoundSnapshot,
  saveMinesRoundSnapshot,
} from "@/lib/arcade/minesRoundPersistence";
import { createRng } from "@/lib/arcade/rng";
import { BET_STEPS } from "@/lib/arcade/slot-configs";
import {
  MINES_PRESENTATION_TIMING,
  minesPresentationDelay,
  minesRiskLabel,
  minesRiskLevel,
} from "@/lib/arcade/minesPresentation";
import { playMinesSound } from "@/lib/arcade/minesSound";
import { playSound, setAmbienceEnergy, setGameAmbience } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import { AnimatedWinCounter } from "./AnimatedWinCounter";
import { BetControls } from "./BetControls";
import "./MinesPremium.css";
import "./MinesInteraction.css";
import "./MinesOrchestration.css";

type RoundStatus = "idle" | "playing" | "lost" | "won";
type RevealPhase = "idle" | "press" | "unlock" | "gem" | "danger" | "explode" | "cashout";

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function MinesGame() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const [bet, setBet] = useState<number>(BET_STEPS[2]);
  const [mineCount, setMineCount] = useState(3);
  const [mineField, setMineField] = useState<number[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [status, setStatus] = useState<RoundStatus>("idle");
  const [lastPayout, setLastPayout] = useState(0);
  const [lastRoundSafeCells, setLastRoundSafeCells] = useState(0);
  const [lastRoundMultiplier, setLastRoundMultiplier] = useState(1);
  const [lastSafeReveal, setLastSafeReveal] = useState<number | null>(null);
  const [triggeredMine, setTriggeredMine] = useState<number | null>(null);
  const [openingIndex, setOpeningIndex] = useState<number | null>(null);
  const [revealPhase, setRevealPhase] = useState<RevealPhase>("idle");
  const [displayedPossibleWin, setDisplayedPossibleWin] = useState(0);
  const [possibleWinDuration, setPossibleWinDuration] = useState(0);

  const settledRef = useRef(true);
  const roundActiveRef = useRef(false);
  const revealedRef = useRef<Set<number>>(new Set());
  const revealBusyRef = useRef(false);
  const startedAtRef = useRef(0);
  const betRef = useRef(bet);
  const mineCountRef = useRef(mineCount);
  const mineFieldRef = useRef<number[]>(mineField);

  const multiplier = minesMultiplier(mineCount, revealed.size);
  const nextMultiplier = nextMinesMultiplier(mineCount, revealed.size);
  const mineSet = useMemo(() => new Set(mineField), [mineField]);

  useEffect(() => {
    hydrateFromStorage();
    const snapshot = loadMinesRoundSnapshot();
    if (!snapshot) return;

    const restored = new Set(snapshot.revealed);
    betRef.current = snapshot.bet;
    mineCountRef.current = snapshot.mineCount;
    mineFieldRef.current = [...snapshot.mineField];
    setBet(snapshot.bet);
    setMineCount(snapshot.mineCount);
    setMineField(snapshot.mineField);
    setRevealed(restored);
    setLastPayout(0);
    setLastRoundSafeCells(0);
    setLastRoundMultiplier(1);
    setLastSafeReveal(null);
    setTriggeredMine(null);
    setOpeningIndex(null);
    setRevealPhase("idle");
    setPossibleWinDuration(0);
    setDisplayedPossibleWin(Math.round(snapshot.bet * minesMultiplier(snapshot.mineCount, restored.size)));
    setStatus("playing");
    revealedRef.current = restored;
    settledRef.current = false;
    roundActiveRef.current = true;
    revealBusyRef.current = false;
    startedAtRef.current = snapshot.startedAt;
  }, []);

  useEffect(() => { betRef.current = bet; }, [bet]);
  useEffect(() => { mineCountRef.current = mineCount; }, [mineCount]);
  useEffect(() => { mineFieldRef.current = mineField; }, [mineField]);

  useEffect(() => {
    const persistActiveRound = () => {
      if (!roundActiveRef.current || settledRef.current || startedAtRef.current <= 0) return;
      const activeMineField = mineFieldRef.current;
      if (activeMineField.length !== mineCountRef.current) return;
      saveMinesRoundSnapshot({
        version: 1,
        bet: betRef.current,
        mineCount: mineCountRef.current,
        mineField: [...activeMineField],
        revealed: [...revealedRef.current],
        startedAt: startedAtRef.current,
      });
    };

    window.addEventListener("pagehide", persistActiveRound);
    return () => {
      persistActiveRound();
      window.removeEventListener("pagehide", persistActiveRound);
    };
  }, []);

  useEffect(() => {
    setGameAmbience("mines", soundEnabled);
    return () => setGameAmbience("mines", false);
  }, [soundEnabled]);

  useEffect(() => {
    const progressEnergy = status === "playing" ? Math.min(1.24, 0.84 + revealed.size * 0.045) : 0.66;
    setAmbienceEnergy(revealPhase === "danger" || revealPhase === "explode" ? 1.38 : progressEnergy);
  }, [revealPhase, revealed.size, status]);

  function startRound() {
    if (status === "playing" || roundActiveRef.current || revealBusyRef.current) return;

    roundActiveRef.current = true;
    if (!arcadeActions.placeBet(bet)) {
      roundActiveRef.current = false;
      if (bet > balance) playSound("lose", soundEnabled);
      return;
    }

    const nextMineField = createMineField(createRng(), mineCount);
    const startedAt = Date.now();
    betRef.current = bet;
    mineCountRef.current = mineCount;
    mineFieldRef.current = [...nextMineField];
    startedAtRef.current = startedAt;
    saveMinesRoundSnapshot({
      version: 1,
      bet: betRef.current,
      mineCount: mineCountRef.current,
      mineField: [...mineFieldRef.current],
      revealed: [],
      startedAt,
    });
    setMineField(nextMineField);
    revealedRef.current = new Set();
    setRevealed(revealedRef.current);
    setLastPayout(0);
    setLastRoundSafeCells(0);
    setLastRoundMultiplier(1);
    setLastSafeReveal(null);
    setTriggeredMine(null);
    setOpeningIndex(null);
    setRevealPhase("idle");
    setPossibleWinDuration(0);
    setDisplayedPossibleWin(bet);
    setStatus("playing");
    settledRef.current = false;
    playMinesSound("button", soundEnabled);
  }

  async function settleWin(safeCells: number) {
    if (settledRef.current || revealBusyRef.current) return;
    settledRef.current = true;
    revealBusyRef.current = true;
    roundActiveRef.current = false;
    setRevealPhase("cashout");

    const finalMultiplier = minesMultiplier(mineCount, safeCells);
    const payout = Math.round(bet * finalMultiplier);
    const reduceMotion = reducedMotion();

    arcadeActions.credit(payout);
    arcadeActions.recordRound({
      slug: "neon-mines",
      gameName: "Neon Mines",
      bet,
      payout,
      multiplier: finalMultiplier,
      note: `${safeCells} casas seguras`,
    });
    clearMinesRoundSnapshot();
    startedAtRef.current = 0;
    playMinesSound("cashout", soundEnabled);

    try {
      await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.cashoutPress, reduceMotion));
      const countDuration = minesPresentationDelay(MINES_PRESENTATION_TIMING.cashoutCount, reduceMotion);
      setPossibleWinDuration(countDuration);
      setDisplayedPossibleWin(payout);
      playSound("cash", soundEnabled);
      await wait(countDuration);
      await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.cashoutSettle, reduceMotion));

      setLastPayout(payout);
      setLastRoundSafeCells(safeCells);
      setLastRoundMultiplier(finalMultiplier);
      setStatus("won");
      playMinesSound("win", soundEnabled);
      await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.cashoutSettle, reduceMotion));
    } finally {
      setRevealPhase("idle");
      setOpeningIndex(null);
      revealBusyRef.current = false;
    }
  }

  async function revealCell(index: number) {
    if (settledRef.current || !roundActiveRef.current || revealBusyRef.current) return;
    if (status !== "playing" || revealedRef.current.has(index)) return;

    const reduceMotion = reducedMotion();
    revealBusyRef.current = true;
    setOpeningIndex(index);
    setLastSafeReveal(null);
    setRevealPhase("press");
    playMinesSound("tilePress", soundEnabled);

    try {
      await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.press, reduceMotion));

      setRevealPhase("unlock");
      playMinesSound("unlock", soundEnabled);
      await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.unlock, reduceMotion));

      if (mineSet.has(index)) {
        const safeCells = revealedRef.current.size;
        const reachedMultiplier = minesMultiplier(mineCount, safeCells);
        setTriggeredMine(index);
        settledRef.current = true;
        roundActiveRef.current = false;
        arcadeActions.recordRound({
          slug: "neon-mines",
          gameName: "Neon Mines",
          bet,
          payout: 0,
          multiplier: 0,
          note: `Mina encontrada após ${safeCells} casa(s) segura(s)`,
        });
        clearMinesRoundSnapshot();
        startedAtRef.current = 0;
        setRevealPhase("danger");
        playMinesSound("danger", soundEnabled);
        await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.danger, reduceMotion));

        playMinesSound("mineArm", soundEnabled);
        setRevealPhase("explode");
        playMinesSound("explosion", soundEnabled);
        await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.explosion, reduceMotion));
        setLastRoundSafeCells(safeCells);
        setLastRoundMultiplier(reachedMultiplier);
        setStatus("lost");
        await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.lostSettle, reduceMotion));
        return;
      }

      const next = new Set(revealedRef.current);
      next.add(index);
      revealedRef.current = next;
      setRevealed(next);
      const startedAt = startedAtRef.current || Date.now();
      startedAtRef.current = startedAt;
      saveMinesRoundSnapshot({
        version: 1,
        bet: betRef.current,
        mineCount: mineCountRef.current,
        mineField: [...mineFieldRef.current],
        revealed: [...next],
        startedAt,
      });
      setLastSafeReveal(index);
      setRevealPhase("gem");
      playMinesSound("gemReveal", soundEnabled, next.size);

      const targetPossible = Math.round(bet * minesMultiplier(mineCount, next.size));
      const countDuration = minesPresentationDelay(MINES_PRESENTATION_TIMING.possibleWinCount, reduceMotion);
      setPossibleWinDuration(countDuration);
      setDisplayedPossibleWin(targetPossible);
      if (next.size > 1) playMinesSound("multiplierRise", soundEnabled, next.size);

      await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.gemSettle, reduceMotion));
    } finally {
      setRevealPhase("idle");
      setOpeningIndex(null);
      revealBusyRef.current = false;
    }

    const nextSafeCount = revealedRef.current.size;
    if (!settledRef.current && nextSafeCount === 25 - mineCount) await settleWin(nextSafeCount);
  }

  const showMines = status === "lost" || status === "won";
  const insufficient = bet > balance;
  const gemsLeft = Math.max(0, 25 - mineCount - revealed.size);
  const interactionLocked = revealPhase !== "idle";
  const configurationLocked = status === "playing" || interactionLocked;
  const telemetryMultiplier = status === "playing"
    ? multiplier
    : status === "lost" || status === "won"
      ? lastRoundMultiplier
      : 1;
  const telemetryOpened = status === "playing" ? revealed.size : 0;
  const possibleWin = status === "playing"
    ? displayedPossibleWin
    : status === "won"
      ? lastPayout
      : status === "lost"
        ? 0
        : bet;
  const possibleWinCaption = status === "playing"
    ? `${revealed.size} ${revealed.size === 1 ? "gema garantida" : "gemas garantidas"}`
    : status === "won"
      ? `${lastRoundSafeCells} gemas · ${formatMultiplier(lastRoundMultiplier)}`
      : status === "lost"
        ? `Mina após ${lastRoundSafeCells} gemas · ${formatMultiplier(lastRoundMultiplier)}`
        : "Abra o cofre de cristal";
  const progress = Math.min(100, (revealed.size / Math.max(1, 25 - mineCount)) * 100);

  return (
    <div className="mines-machine mines-premium">
      <section
        className={cn(
          "mines-machine__cabinet mines-premium__cabinet",
          status === "lost" && "mines-premium__cabinet--lost",
          revealPhase === "cashout" && "mines-premium__cabinet--cashout",
        )}
        data-reveal-phase={revealPhase}
        data-round-status={status}
        data-risk-level={minesRiskLevel(mineCount)}
      >
        <img className="mines-premium__machine-art" src={neonMinesReference} alt="" aria-hidden />
        <div className="mines-premium__aurora" aria-hidden />
        <div className="mines-premium__rail mines-premium__rail--left" aria-hidden />
        <div className="mines-premium__rail mines-premium__rail--right" aria-hidden />

        <div className="mines-machine__masthead mines-premium__masthead">
          <div className="mines-status-card mines-premium__status">
            <small>GEMAS SEGURAS</small>
            <strong>{gemsLeft}</strong>
            <span>restantes</span>
          </div>

          <div className="mines-title mines-premium__title">
            <div className="mines-premium__crest" aria-hidden><Gem /></div>
            <span>NEON</span>
            <strong>MINES</strong>
            <small>CRYSTAL VAULT · ARCADE PRIVADO</small>
          </div>

          <div className="mines-status-card mines-premium__status">
            <small>PRÓXIMO GANHO</small>
            <strong>{formatCoins(Math.round(bet * nextMultiplier))}</strong>
            <span>{formatMultiplier(nextMultiplier)}</span>
          </div>
        </div>

        <div className={cn("mines-premium__telemetry", revealPhase === "gem" && "mines-premium__telemetry--counting")} aria-label="Informações da rodada">
          <div><small>RISCO</small><strong data-risk={minesRiskLevel(mineCount)}>{minesRiskLabel(mineCount)}</strong></div>
          <div><small>MULTIPLICADOR</small><strong>{formatMultiplier(telemetryMultiplier)}</strong></div>
          <div><small>GEMAS ABERTAS</small><strong>{telemetryOpened}</strong></div>
        </div>

        <div className="mines-premium__grid-frame">
          <div className="mines-premium__corner mines-premium__corner--tl" aria-hidden />
          <div className="mines-premium__corner mines-premium__corner--tr" aria-hidden />
          <div className="mines-premium__corner mines-premium__corner--bl" aria-hidden />
          <div className="mines-premium__corner mines-premium__corner--br" aria-hidden />

          <div className="mines-grid mines-premium__grid" role="grid" aria-label="Campo de 25 casas">
            {Array.from({ length: 25 }, (_, index) => {
              const isMine = mineSet.has(index);
              const isRevealed = revealed.has(index);
              const isTriggeredMine = triggeredMine === index;
              const mineInImpact = isTriggeredMine && (revealPhase === "danger" || revealPhase === "explode");
              const visibleMine = isMine && (showMines || mineInImpact);
              const isFreshGem = isRevealed && lastSafeReveal === index;
              const isOpening = openingIndex === index;

              return (
                <button
                  key={index}
                  type="button"
                  className={cn(
                    "mines-tile mines-premium__tile",
                    status === "playing" && !isRevealed && "mines-tile--ready mines-premium__tile--ready",
                    isOpening && revealPhase === "press" && "mines-premium__tile--pressing",
                    isOpening && revealPhase === "unlock" && "mines-premium__tile--unlocking",
                    isOpening && revealPhase === "danger" && "mines-premium__tile--danger-pending",
                    isOpening && revealPhase === "explode" && "mines-premium__tile--exploding",
                    isRevealed && "mines-tile--gem mines-premium__tile--gem",
                    isFreshGem && "mines-premium__tile--fresh-gem",
                    visibleMine && "mines-tile--mine mines-premium__tile--mine",
                    isTriggeredMine && (showMines || mineInImpact) && "mines-premium__tile--triggered",
                  )}
                  disabled={status !== "playing" || isRevealed || interactionLocked}
                  onClick={() => void revealCell(index)}
                  aria-label={isRevealed ? `Casa ${index + 1}, segura` : visibleMine ? `Casa ${index + 1}, mina` : `Revelar casa ${index + 1}`}
                  aria-busy={isOpening && interactionLocked}
                >
                  <span className="mines-premium__tile-rivet mines-premium__tile-rivet--a" aria-hidden />
                  <span className="mines-premium__tile-rivet mines-premium__tile-rivet--b" aria-hidden />
                  {visibleMine ? (
                    <span className="mines-premium__danger" aria-hidden><Bomb /></span>
                  ) : isRevealed ? (
                    <span className="mines-premium__gem" aria-hidden><Gem /></span>
                  ) : (
                    <span className="mines-premium__sealed" aria-hidden>
                      <span className="mines-tile__facet" />
                      <Sparkles />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className={cn("mines-possible mines-premium__possible", revealPhase === "gem" && "mines-premium__possible--counting")}>
          <div className="mines-premium__possible-copy">
            <small>GANHO POSSÍVEL</small>
            <strong><AnimatedWinCounter value={possibleWin} duration={possibleWinDuration} /></strong>
            <span>{possibleWinCaption}</span>
          </div>
          <div className="mines-premium__progress" aria-hidden><span style={{ width: `${progress}%` }} /></div>
          <div className="mines-multipliers mines-premium__multipliers" aria-hidden>
            {[1, 1.25, 1.43, 1.67, 2, 2.5].map((value, index) => (
              <span key={value} className={index <= Math.min(5, revealed.size) ? "is-active" : ""}>{value}×</span>
            ))}
          </div>
        </div>

        {status === "lost" && (
          <div className="mines-result mines-result--lost mines-premium__result" role="status" aria-live="assertive">
            <Bomb className="size-5" />
            <div>
              <strong>MINA ENCONTRADA</strong>
              <span>{lastRoundSafeCells} gemas abertas · você chegou a {formatMultiplier(lastRoundMultiplier)} antes da explosão.</span>
            </div>
          </div>
        )}
        {status === "won" && (
          <div className="mines-result mines-result--won mines-premium__result mines-premium__result--cashout" role="status" aria-live="polite">
            <Trophy className="size-5" />
            <div><strong>CRISTAL GARANTIDO</strong><span>+ {formatCoins(lastPayout)} moedas fictícias · {formatMultiplier(lastRoundMultiplier)}</span></div>
          </div>
        )}

        <div className="mines-controls mines-premium__controls">
          <div className="mines-controls__bet mines-premium__bet"><BetControls value={bet} onChange={(value) => { setBet(value); playSound("click", soundEnabled); }} disabled={configurationLocked} /></div>
          <section className="mines-selector mines-premium__selector">
            <small>MINAS / RISCO</small>
            <div>
              {[1, 3, 5, 10].map((count) => {
                const label = minesRiskLabel(count);
                return (
                  <Button
                    key={count}
                    size="sm"
                    variant={mineCount === count ? "gold" : "outline"}
                    disabled={configurationLocked}
                    onClick={() => { setMineCount(count); playSound("click", soundEnabled); }}
                    aria-label={`${count} minas, risco ${label.toLowerCase()}`}
                    aria-pressed={mineCount === count}
                  >
                    <strong>{count}</strong>
                    <span>{label}</span>
                  </Button>
                );
              })}
            </div>
          </section>

          {status === "playing" ? (
            <Button
              size="lg"
              variant="gold"
              className={cn(
                "mines-cash-button mines-premium__action",
                revealed.size > 0 && "mines-premium__action--cashout-ready",
                revealPhase === "cashout" && "mines-premium__action--settling",
              )}
              disabled={revealed.size === 0 || interactionLocked}
              onClick={() => void settleWin(revealed.size)}
              aria-label={`Garantir ganho de ${formatCoins(Math.round(bet * multiplier))}`}
              aria-busy={revealPhase === "cashout"}
            >
              <ShieldCheck className="size-6" aria-hidden />
              <span>{revealPhase === "cashout" ? "GARANTINDO" : "GARANTIR"}</span>
              <strong>{formatCoins(Math.round(bet * multiplier))}</strong>
            </Button>
          ) : (
            <Button size="lg" variant="gold" className="mines-cash-button mines-premium__action" disabled={insufficient || interactionLocked} onClick={startRound} aria-label={`Abrir cofre apostando ${formatCoins(bet)}`}>
              <Play className="size-6" aria-hidden />
              <span>ABRIR COFRE</span>
              <strong>{formatCoins(bet)}</strong>
            </Button>
          )}
        </div>
      </section>

      <p className="game-machine-note mines-premium__note">Revele cristais, aumente o multiplicador e garanta o ganho antes de encontrar uma mina. Apenas moedas fictícias.</p>
    </div>
  );
}
