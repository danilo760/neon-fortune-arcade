import { Bomb, Gem, Play, ShieldCheck, Trophy } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createMineField, minesMultiplier, nextMinesMultiplier } from "@/lib/arcade/mines";
import { formatCoins, formatMultiplier } from "@/lib/arcade/format";
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

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="rounded-3xl border border-jade/25 bg-ink/80 p-3 shadow-2xl sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Campo 5 × 5
            </p>
            <p className="font-display font-bold text-jade">
              {status === "playing" ? `${revealed.size} seguras reveladas` : "Escolha com cuidado"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[0.62rem] uppercase tracking-widest text-muted-foreground">
              Multiplicador
            </p>
            <p className="font-display text-xl font-black text-primary">
              {formatMultiplier(multiplier)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2 rounded-2xl border border-border/70 bg-background/60 p-2 sm:gap-3 sm:p-4">
          {Array.from({ length: 25 }, (_, index) => {
            const isMine = mineSet.has(index);
            const isRevealed = revealed.has(index);
            const visibleMine = showMines && isMine;
            return (
              <button
                key={index}
                type="button"
                className={cn(
                  "flex aspect-square items-center justify-center rounded-xl border text-xl transition-all sm:text-3xl",
                  status === "playing" && !isRevealed
                    ? "border-jade/30 bg-ink-soft hover:-translate-y-0.5 hover:border-jade hover:bg-jade/10"
                    : "border-border/50 bg-background/70",
                  isRevealed &&
                    "border-jade bg-jade/15 motion-safe:animate-[pop-in_250ms_ease-out]",
                  visibleMine && "border-destructive bg-destructive/20",
                )}
                disabled={status !== "playing" || isRevealed}
                onClick={() => revealCell(index)}
                aria-label={
                  isRevealed
                    ? `Casa ${index + 1}, segura`
                    : visibleMine
                      ? `Casa ${index + 1}, mina`
                      : `Revelar casa ${index + 1}`
                }
              >
                {visibleMine ? (
                  <Bomb className="size-6 text-destructive sm:size-8" aria-hidden />
                ) : isRevealed ? (
                  <Gem className="size-6 text-jade sm:size-8" aria-hidden />
                ) : (
                  <span className="text-primary/25">✦</span>
                )}
              </button>
            );
          })}
        </div>

        {status === "lost" && (
          <div
            className="mt-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-center"
            role="status"
          >
            <p className="font-display font-bold text-destructive-foreground">A mina explodiu</p>
            <p className="text-sm text-muted-foreground">
              Você perdeu somente a aposta fictícia desta rodada.
            </p>
          </div>
        )}
        {status === "won" && (
          <div
            className="mt-3 rounded-2xl border border-jade/40 bg-jade/10 p-3 text-center"
            role="status"
          >
            <p className="flex items-center justify-center gap-1 font-display font-bold text-jade">
              <Trophy className="size-4" aria-hidden /> Coleta concluída
            </p>
            <p className="text-xl font-black tabular-nums text-primary">
              + {formatCoins(lastPayout)} moedas
            </p>
          </div>
        )}
      </section>

      <aside className="grid content-start gap-3">
        <BetControls value={bet} onChange={setBet} disabled={status === "playing"} />
        <section className="rounded-2xl surface-panel p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Quantidade de minas
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[1, 3, 5, 10].map((count) => (
              <Button
                key={count}
                size="sm"
                variant={mineCount === count ? "gold" : "outline"}
                disabled={status === "playing"}
                onClick={() => setMineCount(count)}
                aria-pressed={mineCount === count}
              >
                {count}
              </Button>
            ))}
          </div>
        </section>

        {status === "playing" ? (
          <Button
            size="lg"
            variant="gold"
            className="min-h-14 rounded-2xl text-base font-black"
            disabled={revealed.size === 0}
            onClick={() => settleWin(revealed.size)}
          >
            <ShieldCheck className="size-5" aria-hidden /> Coletar{" "}
            {formatCoins(Math.round(bet * multiplier))}
          </Button>
        ) : (
          <Button
            size="lg"
            variant="gold"
            className="min-h-14 rounded-2xl text-base font-black"
            disabled={insufficient}
            onClick={startRound}
          >
            <Play className="size-5" aria-hidden /> Nova rodada
          </Button>
        )}

        <div className="rounded-2xl border border-border/70 bg-ink/60 p-3 text-sm text-muted-foreground">
          <p>
            Próxima casa segura:{" "}
            <strong className="text-jade">{formatMultiplier(nextMultiplier)}</strong>
          </p>
          <p className="mt-1">Quanto mais minas e casas seguras, maior o multiplicador fictício.</p>
        </div>
      </aside>
    </div>
  );
}
