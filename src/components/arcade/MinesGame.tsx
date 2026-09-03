import { Bomb, Gem, Play, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import neonMinesReference from "@/assets/neon-mines-reference.webp";
import { formatCoins, formatMultiplier } from "@/lib/arcade/format";
import { createMineField, minesMultiplier, nextMinesMultiplier } from "@/lib/arcade/mines";
import { createRng } from "@/lib/arcade/rng";
import { BET_STEPS } from "@/lib/arcade/slot-configs";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import { BetControls } from "./BetControls";
import "./MinesPremium.css";

type RoundStatus = "idle" | "playing" | "lost" | "won";

function riskLabel(mineCount: number) {
  if (mineCount <= 1) return "LOW";
  if (mineCount <= 3) return "BALANCED";
  if (mineCount <= 5) return "HIGH";
  return "EXTREME";
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
  const settledRef = useRef(true);

  const multiplier = minesMultiplier(mineCount, revealed.size);
  const nextMultiplier = nextMinesMultiplier(mineCount, revealed.size);
  const mineSet = useMemo(() => new Set(mineField), [mineField]);

  function startRound() {
    if (status === "playing" || !arcadeActions.placeBet(bet)) {
      if (bet > balance) playSound("lose", soundEnabled);
      return;
    }
    setMineField(createMineField(createRng(), mineCount));
    setRevealed(new Set());
    setLastPayout(0);
    setStatus("playing");
    settledRef.current = false;
    playSound("spin", soundEnabled);
  }

  function settleWin(safeCells: number) {
    if (settledRef.current) return;
    settledRef.current = true;
    const finalMultiplier = minesMultiplier(mineCount, safeCells);
    const payout = Math.round(bet * finalMultiplier);
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
    playSound(payout >= bet * 10 ? "bigWin" : "cash", soundEnabled);
  }

  function revealCell(index: number) {
    if (status !== "playing" || revealed.has(index)) return;
    if (mineSet.has(index)) {
      settledRef.current = true;
      setStatus("lost");
      arcadeActions.recordRound({
        slug: "neon-mines",
        gameName: "Neon Mines",
        bet,
        payout: 0,
        multiplier: 0,
        note: "Mina encontrada",
      });
      playSound("lose", soundEnabled);
      return;
    }

    const next = new Set(revealed);
    next.add(index);
    setRevealed(next);
    playSound("tick", soundEnabled);
    if (next.size === 25 - mineCount) settleWin(next.size);
  }

  const showMines = status === "lost" || status === "won";
  const insufficient = bet > balance;
  const gemsLeft = Math.max(0, 25 - mineCount - revealed.size);
  const possibleWin = Math.round(bet * (status === "playing" ? multiplier : 1));
  const progress = Math.min(100, (revealed.size / Math.max(1, 25 - mineCount)) * 100);

  return (
    <div className="mines-machine mines-premium">
      <section className="mines-machine__cabinet mines-premium__cabinet">
        <img className="mines-premium__machine-art" src={neonMinesReference} alt="" aria-hidden />
        <div className="mines-premium__aurora" aria-hidden />
        <div className="mines-premium__rail mines-premium__rail--left" aria-hidden />
        <div className="mines-premium__rail mines-premium__rail--right" aria-hidden />

        <div className="mines-machine__masthead mines-premium__masthead">
          <div className="mines-status-card mines-premium__status">
            <small>SAFE GEMS</small>
            <strong>{gemsLeft}</strong>
            <span>remaining</span>
          </div>

          <div className="mines-title mines-premium__title">
            <div className="mines-premium__crest" aria-hidden><Gem /></div>
            <span>NEON</span>
            <strong>MINES</strong>
            <small>CRYSTAL VAULT · PRIVATE ARCADE</small>
          </div>

          <div className="mines-status-card mines-premium__status">
            <small>NEXT WIN</small>
            <strong>{formatCoins(Math.round(bet * nextMultiplier))}</strong>
            <span>{formatMultiplier(nextMultiplier)}</span>
          </div>
        </div>

        <div className="mines-premium__telemetry" aria-label="Informações da rodada">
          <div><small>RISK</small><strong data-risk={riskLabel(mineCount)}>{riskLabel(mineCount)}</strong></div>
          <div><small>CURRENT</small><strong>{formatMultiplier(status === "playing" ? multiplier : 1)}</strong></div>
          <div><small>FOUND</small><strong>{revealed.size}</strong></div>
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

              return (
                <button
                  key={index}
                  type="button"
                  className={cn(
                    "mines-tile mines-premium__tile",
                    status === "playing" && !isRevealed && "mines-tile--ready mines-premium__tile--ready",
                    isRevealed && "mines-tile--gem mines-premium__tile--gem",
                    visibleMine && "mines-tile--mine mines-premium__tile--mine",
                  )}
                  disabled={status !== "playing" || isRevealed}
                  onClick={() => revealCell(index)}
                  aria-label={isRevealed ? `Casa ${index + 1}, segura` : visibleMine ? `Casa ${index + 1}, mina` : `Revelar casa ${index + 1}`}
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

        <div className="mines-possible mines-premium__possible">
          <div className="mines-premium__possible-copy">
            <small>POSSIBLE WIN</small>
            <strong>{formatCoins(possibleWin)}</strong>
            <span>{status === "playing" ? `${revealed.size} gem${revealed.size === 1 ? "" : "s"} secured` : "Open the crystal vault"}</span>
          </div>
          <div className="mines-premium__progress" aria-hidden>
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="mines-multipliers mines-premium__multipliers" aria-hidden>
            {[1, 1.25, 1.43, 1.67, 2, 2.5].map((value, index) => (
              <span key={value} className={index <= Math.min(5, revealed.size) ? "is-active" : ""}>{value}×</span>
            ))}
          </div>
        </div>

        {status === "lost" && (
          <div className="mines-result mines-result--lost mines-premium__result" role="status">
            <Bomb className="size-5" />
            <div><strong>Vault breached</strong><span>A mina explodiu. Somente a aposta fictícia desta rodada foi perdida.</span></div>
          </div>
        )}
        {status === "won" && (
          <div className="mines-result mines-result--won mines-premium__result" role="status">
            <Trophy className="size-5" />
            <div><strong>Crystal secured</strong><span>+ {formatCoins(lastPayout)} moedas fictícias</span></div>
          </div>
        )}

        <div className="mines-controls mines-premium__controls">
          <div className="mines-controls__bet mines-premium__bet"><BetControls value={bet} onChange={setBet} disabled={status === "playing"} /></div>
          <section className="mines-selector mines-premium__selector">
            <small>MINES / RISK</small>
            <div>
              {[1, 3, 5, 10].map((count) => (
                <Button key={count} size="sm" variant={mineCount === count ? "gold" : "outline"} disabled={status === "playing"} onClick={() => setMineCount(count)} aria-pressed={mineCount === count}>{count}</Button>
              ))}
            </div>
          </section>

          {status === "playing" ? (
            <Button size="lg" variant="gold" className="mines-cash-button mines-premium__action" disabled={revealed.size === 0} onClick={() => settleWin(revealed.size)}>
              <ShieldCheck className="size-6" aria-hidden />
              <span>CASH OUT</span>
              <strong>{formatCoins(Math.round(bet * multiplier))}</strong>
            </Button>
          ) : (
            <Button size="lg" variant="gold" className="mines-cash-button mines-premium__action" disabled={insufficient} onClick={startRound}>
              <Play className="size-6" aria-hidden />
              <span>OPEN VAULT</span>
              <strong>{formatCoins(bet)}</strong>
            </Button>
          )}
        </div>
      </section>

      <p className="game-machine-note mines-premium__note">Cada casa segura aumenta o multiplicador. Resultado, aposta e crédito continuam usando exatamente a lógica fictícia existente.</p>
    </div>
  );
}
