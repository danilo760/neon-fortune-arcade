import { CircleDot, Play, Sparkles } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatCoins, formatMultiplier } from "@/lib/arcade/format";
import { dropBall, plinkoPayouts, RISK_LABELS, type PlinkoRisk } from "@/lib/arcade/plinko";
import { createRng } from "@/lib/arcade/rng";
import { BET_STEPS } from "@/lib/arcade/slot-configs";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import { BetControls } from "./BetControls";

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export function PlinkoGame() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const [bet, setBet] = useState<number>(BET_STEPS[2]);
  const [risk, setRisk] = useState<PlinkoRisk>("medio");
  const [rows, setRows] = useState(14);
  const [path, setPath] = useState<number[]>([]);
  const [step, setStep] = useState(-1);
  const [winningBucket, setWinningBucket] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState<{ payout: number; multiplier: number } | null>(null);
  const busyRef = useRef(false);

  const payouts = plinkoPayouts(risk, rows);
  const dropping = step >= 0 && step < rows;
  const rights = path.slice(0, Math.max(0, step + 1)).reduce((sum, move) => sum + move, 0);
  const ballLeft = step < 0 ? 50 : 50 + (rights - (step + 1) / 2) * (72 / rows);
  const ballTop = step < 0 ? 4 : 8 + ((step + 1) / rows) * 70;

  async function drop() {
    if (busyRef.current || !arcadeActions.placeBet(bet)) {
      if (bet > balance) playSound("lose", soundEnabled);
      return;
    }
    busyRef.current = true;
    setLastWin(null);
    setWinningBucket(null);
    playSound("spin", soundEnabled);

    // Path and final bucket are fixed before the animation begins.
    const outcome = dropBall(createRng(), rows);
    setPath(outcome.path);
    setStep(0);
    for (let index = 0; index < rows; index++) {
      setStep(index);
      playSound("tick", soundEnabled);
      await delay(90);
    }

    const multiplier = payouts[outcome.bucket] ?? 0;
    const payout = Math.round(bet * multiplier);
    setWinningBucket(outcome.bucket);
    setStep(rows);
    setLastWin({ payout, multiplier });
    if (payout > 0) arcadeActions.credit(payout);
    arcadeActions.recordRound({
      slug: "neon-plinko",
      gameName: "Neon Plinko",
      bet,
      payout,
      multiplier,
      note: `Risco ${RISK_LABELS[risk]} · ${rows} linhas`,
    });
    playSound(payout >= bet * 10 ? "bigWin" : payout >= bet ? "win" : "lose", soundEnabled);
    busyRef.current = false;
    await delay(500);
    setStep(-1);
  }

  const insufficient = bet > balance;

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="rounded-3xl border border-magenta/30 bg-ink/80 p-3 shadow-2xl sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Tabuleiro neon
            </p>
            <p className="font-display font-bold text-magenta">
              {rows} linhas · risco {RISK_LABELS[risk].toLowerCase()}
            </p>
          </div>
          {lastWin && (
            <div className="text-right" role="status" aria-live="polite">
              <p className="text-[0.62rem] uppercase tracking-widest text-muted-foreground">
                Resultado
              </p>
              <p className="font-display font-black text-primary">
                +{formatCoins(lastWin.payout)} · {formatMultiplier(lastWin.multiplier)}
              </p>
            </div>
          )}
        </div>

        <div className="relative h-[28rem] max-h-[68vh] min-h-[23rem] overflow-hidden rounded-2xl border border-magenta/20 bg-[radial-gradient(circle_at_50%_5%,oklch(0.56_0.22_300/0.24),transparent_48%),linear-gradient(180deg,oklch(0.18_0.06_300),oklch(0.12_0.04_300))] px-1 pb-14 pt-8">
          <div
            className="absolute inset-x-[8%] top-8 bottom-16 flex flex-col justify-around"
            aria-hidden
          >
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="flex justify-center gap-[clamp(0.35rem,2vw,1.45rem)]">
                {Array.from({ length: row + 3 }, (_, peg) => (
                  <span
                    key={peg}
                    className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_oklch(0.82_0.15_88/0.85)] sm:size-2"
                  />
                ))}
              </div>
            ))}
          </div>

          <div
            className={cn(
              "absolute z-20 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80 bg-magenta shadow-[0_0_18px_oklch(0.68_0.24_340)] transition-[left,top] duration-100 ease-in sm:size-6",
              dropping && "motion-safe:animate-pulse",
            )}
            style={{ left: `${ballLeft}%`, top: `${ballTop}%` }}
            aria-hidden
          />

          <div
            className="absolute inset-x-1 bottom-2 grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${payouts.length}, minmax(0, 1fr))` }}
          >
            {payouts.map((value, index) => (
              <div
                key={`${index}-${value}`}
                className={cn(
                  "flex h-10 items-center justify-center rounded-sm border border-border/60 bg-ink-soft px-0.5 text-[0.48rem] font-black tabular-nums text-muted-foreground sm:text-[0.65rem]",
                  value >= 10 && "border-primary/60 text-primary",
                  winningBucket === index &&
                    "border-jade bg-jade/20 text-jade motion-safe:animate-[win-pulse_700ms_ease-in-out_infinite]",
                )}
              >
                {value}x
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="grid content-start gap-3">
        <BetControls value={bet} onChange={setBet} disabled={dropping} />
        <section className="rounded-2xl surface-panel p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Nível de risco
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(["baixo", "medio", "alto"] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={risk === value ? "gold" : "outline"}
                disabled={dropping}
                onClick={() => setRisk(value)}
                aria-pressed={risk === value}
              >
                {RISK_LABELS[value]}
              </Button>
            ))}
          </div>
        </section>
        <section className="rounded-2xl surface-panel p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Linhas de pinos
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[12, 14, 16].map((value) => (
              <Button
                key={value}
                size="sm"
                variant={rows === value ? "gold" : "outline"}
                disabled={dropping}
                onClick={() => setRows(value)}
                aria-pressed={rows === value}
              >
                {value}
              </Button>
            ))}
          </div>
        </section>
        <Button
          size="lg"
          variant="gold"
          className="min-h-14 rounded-2xl text-base font-black"
          disabled={dropping || insufficient}
          onClick={() => void drop()}
        >
          {dropping ? (
            <CircleDot className="size-5 animate-bounce" aria-hidden />
          ) : (
            <Play className="size-5" aria-hidden />
          )}
          {dropping ? "Caindo..." : "Soltar bola"}
        </Button>
        <div className="rounded-2xl border border-border/70 bg-ink/60 p-3 text-xs text-muted-foreground">
          <p className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wider text-magenta">
            <Sparkles className="size-4" aria-hidden /> Resultado único
          </p>
          <p>
            O caminho e o multiplicador são definidos antes da animação. O saldo é atualizado uma
            única vez por queda.
          </p>
        </div>
      </aside>
    </div>
  );
}
