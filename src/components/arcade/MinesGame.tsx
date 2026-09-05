import { Bomb, Gem, Play, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import neonMinesReference from "@/assets/neon-mines-reference.webp";
import { Button } from "@/components/ui/button";
import { formatCoins, formatMultiplier } from "@/lib/arcade/format";
import { createMineField, minesMultiplier, nextMinesMultiplier } from "@/lib/arcade/mines";
import { createRng } from "@/lib/arcade/rng";
import { BET_STEPS } from "@/lib/arcade/slot-configs";
import {
  MINES_PRESENTATION_TIMING,
  minesPresentationDelay,
  minesRiskLabel,
  minesRiskLevel,
} from "@/lib/arcade/minesPresentation";
import { playMinesSound } from "@/lib/arcade/minesSound";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, useArcade } from "@/lib/arcade/store";
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

  const multiplier = minesMultiplier(mineCount, revealed.size);
  const nextMultiplier = nextMinesMultiplier(mineCount, revealed.size);
  const mineSet = useMemo(() => new Set(mineField), [mineField]);

  function startRound() {
    if (
      status === "playing" ||
      roundActiveRef.current ||
      revealBusyRef.current ||
      !arcadeActions.placeBet(bet)
    ) {
      if (bet > balance) playSound("lose", soundEnabled);
      return;
    }

    roundActiveRef.current = true;
    setMineField(createMineField(createRng(), mineCount));
    revealedRef.current = new Set();
    setRevealed(revealedRef.current);
    setLastPayout(0);
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
    playMinesSound("cashout", soundEnabled);

    await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.cashoutPress, reduceMotion));
    const countDuration = minesPresentationDelay(MINES_PRESENTATION_TIMING.cashoutCount, reduceMotion);
    setPossibleWinDuration(countDuration);
    setDisplayedPossibleWin(payout);
    await wait(countDuration);
    await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.cashoutSettle, reduceMotion));

    arcadeActions.credit(payout);
    arcadeActions.recordRound({
      slug: "neon-mines",
      gameName: "Neon Mines",
      bet,
      payout,
      multiplier: finalMultiplier,
      note: `${safeCells} casas seguras`,
    });
    setLastPayout(payout);
    setStatus("won");
    setRevealPhase("idle");
    revealBusyRef.current = false;
    playMinesSound("win", soundEnabled);
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
    await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.press, reduceMotion));

    setRevealPhase("unlock");
    playMinesSound("unlock", soundEnabled);
    await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.unlock, reduceMotion));

    if (mineSet.has(index)) {
      setTriggeredMine(index);
      setRevealPhase("danger");
      playMinesSound("danger", soundEnabled);
      await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.danger, reduceMotion));

      settledRef.current = true;
      roundActiveRef.current = false;
      playMinesSound("mineArm", soundEnabled);
      setRevealPhase("explode");
      playMinesSound("explosion", soundEnabled);
      await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.explosion, reduceMotion));
      setStatus("lost");
      arcadeActions.recordRound({
        slug: "neon-mines",
        gameName: "Neon Mines",
        bet,
        payout: 0,
        multiplier: 0,
        note: "Mina encontrada",
      });
      await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.lostSettle, reduceMotion));
      setRevealPhase("idle");
      setOpeningIndex(null);
      revealBusyRef.current = false;
      return;
    }

    const next = new Set(revealedRef.current);
    next.add(index);
    revealedRef.current = next;
    setRevealed(next);
    setLastSafeReveal(index);
    setRevealPhase("gem");
    playMinesSound("gemReveal", soundEnabled, next.size);

    const targetPossible = Math.round(bet * minesMultiplier(mineCount, next.size));
    const countDuration = minesPresentationDelay(MINES_PRESENTATION_TIMING.possibleWinCount, reduceMotion);
    setPossibleWinDuration(countDuration);
    setDisplayedPossibleWin(targetPossible);
    if (next.size > 1) playMinesSound("multiplierRise", soundEnabled, next.size);

    await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.gemSettle, reduceMotion));
    setRevealPhase("idle");
    setOpeningIndex(null);
    revealBusyRef.current = false;

    if (next.size === 25 - mineCount) await settleWin(next.size);
  }

  const showMines = status === "lost" || status === "won";
  const insufficient = bet > balance;
  const gemsLeft = Math.max(0, 25 - mineCount - revealed.size);
  const possibleWin = status === "playing" ? displayedPossibleWin : lastPayout > 0 ? lastPayout : bet;
  const progress = Math.min(100, (revealed.size / Math.max(1, 25 - mineCount)) * 100);
  const interactionLocked = revealPhase !== "idle";

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
          <div><small>MULTIPLICADOR</small><strong>{formatMultiplier(status === "playing" ? multiplier : 1)}</strong></div>
          <div><small>ENCONTRADAS</small><strong>{revealed.size}</strong></div>
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
              const visibleMine = showMines && isMine;
              const isFreshGem = isRevealed && lastSafeReveal === index;
              const isTriggeredMine = triggeredMine === index;
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
                    isTriggeredMine && showMines && "mines-premium__tile--triggered",
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
            <span>{status === "playing" ? `${revealed.size} ${revealed.size === 1 ? "gema garantida" : "gemas garantidas"}` : "Abra o cofre de cristal"}</span>
          </div>
          <div className="mines-premium__progress" aria-hidden><span style={{ width: `${progress}%` }} /></div>
          <div className="mines-multipliers mines-premium__multipliers" aria-hidden>
            {[1, 1.25, 1.43, 1.67, 2, 2.5].map((value, index) => (
              <span key={value} className={index <= Math.min(5, revealed.size) ? "is-active" : ""}>{value}×</span>
            ))}
          </div>
        </div>

        {status === "lost" && (
          <div className="mines-result mines-result--lost mines-premium__result" role="status">
            <Bomb className="size-5" />
            <div><strong>COFRE VIOLADO</strong><span>A mina explodiu. Somente a aposta fictícia desta rodada foi perdida.</span></div>
          </div>
        )}
        {status === "won" && (
          <div className="mines-result mines-result--won mines-premium__result mines-premium__result--cashout" role="status">
            <Trophy className="size-5" />
            <div><strong>CRISTAL GARANTIDO</strong><span>+ {formatCoins(lastPayout)} moedas fictícias</span></div>
          </div>
        )}

        <div className="mines-controls mines-premium__controls">
          <div className="mines-controls__bet mines-premium__bet"><BetControls value={bet} onChange={setBet} disabled={status === "playing"} /></div>
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
                    disabled={status === "playing"}
                    onClick={() => setMineCount(count)}
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

      <p className="game-machine-note mines-premium__note">Cada casa segura aumenta o multiplicador. A matemática, o campo pré-calculado, a aposta e o crédito continuam usando a lógica fictícia existente.</p>
    </div>
  );
}
