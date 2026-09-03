import { Bomb, Gem, Play, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatCoins, formatMultiplier } from "@/lib/arcade/format";
import { createMineField, minesMultiplier, nextMinesMultiplier } from "@/lib/arcade/mines";
import { createRng } from "@/lib/arcade/rng";
import { BET_STEPS } from "@/lib/arcade/slot-configs";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import { BetControls } from "./BetControls";

type RoundStatus = "idle" | "playing" | "lost" | "won";

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

  return (
    <div className="mines-machine">
      <section className="mines-machine__cabinet">
        <div className="mines-machine__masthead">
          <div className="mines-status-card"><small>GEMS LEFT</small><strong>{gemsLeft}</strong></div>
          <div className="mines-title"><Sparkles className="size-5" aria-hidden /><span>NEON</span><strong>MINES</strong><small>PRIVATE ARCADE</small></div>
          <div className="mines-status-card"><small>NEXT WIN</small><strong>{formatCoins(Math.round(bet * nextMultiplier))}</strong></div>
        </div>

        <div className="mines-grid" role="grid" aria-label="Campo de 25 casas">
          {Array.from({ length: 25 }, (_, index) => {
            const isMine = mineSet.has(index);
            const isRevealed = revealed.has(index);
            const visibleMine = showMines && isMine;
            return (
              <button
                key={index}
                type="button"
                className={cn(
                  "mines-tile",
                  status === "playing" && !isRevealed && "mines-tile--ready",
                  isRevealed && "mines-tile--gem",
                  visibleMine && "mines-tile--mine",
                )}
                disabled={status !== "playing" || isRevealed}
                onClick={() => revealCell(index)}
                aria-label={isRevealed ? `Casa ${index + 1}, segura` : visibleMine ? `Casa ${index + 1}, mina` : `Revelar casa ${index + 1}`}
              >
                {visibleMine ? <Bomb className="size-[55%]" aria-hidden /> : isRevealed ? <Gem className="size-[60%]" aria-hidden /> : <span className="mines-tile__facet" aria-hidden />}
              </button>
            );
          })}
        </div>

        <div className="mines-possible">
          <small>POSSIBLE WIN</small>
          <strong>{formatCoins(possibleWin)}</strong>
          <div className="mines-multipliers" aria-hidden>
            {[1, 1.25, 1.43, 1.67, 2, 2.5].map((value, index) => <span key={value} className={index <= Math.min(5, revealed.size) ? "is-active" : ""}>{value}x</span>)}
          </div>
        </div>

        {status === "lost" && <div className="mines-result mines-result--lost" role="status"><Bomb className="size-5" /><div><strong>A mina explodiu</strong><span>Somente a aposta fictícia da rodada foi perdida.</span></div></div>}
        {status === "won" && <div className="mines-result mines-result--won" role="status"><Trophy className="size-5" /><div><strong>Coleta concluída</strong><span>+ {formatCoins(lastPayout)} moedas fictícias</span></div></div>}

        <div className="mines-controls">
          <div className="mines-controls__bet"><BetControls value={bet} onChange={setBet} disabled={status === "playing"} /></div>
          <section className="mines-selector">
            <small>MINES</small>
            <div>{[1, 3, 5, 10].map((count) => <Button key={count} size="sm" variant={mineCount === count ? "gold" : "outline"} disabled={status === "playing"} onClick={() => setMineCount(count)} aria-pressed={mineCount === count}>{count}</Button>)}</div>
          </section>
          {status === "playing" ? (
            <Button size="lg" variant="gold" className="mines-cash-button" disabled={revealed.size === 0} onClick={() => settleWin(revealed.size)}><ShieldCheck className="size-6" aria-hidden /><span>CASH OUT</span><strong>{formatCoins(Math.round(bet * multiplier))}</strong></Button>
          ) : (
            <Button size="lg" variant="gold" className="mines-cash-button" disabled={insufficient} onClick={startRound}><Play className="size-6" aria-hidden /><span>NOVA RODADA</span><strong>{formatCoins(bet)}</strong></Button>
          )}
        </div>
      </section>

      <p className="game-machine-note">Cada casa segura aumenta o multiplicador. Resultado e crédito continuam definidos apenas pela lógica fictícia já existente.</p>
    </div>
  );
}
