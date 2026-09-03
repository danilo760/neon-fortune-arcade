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
import { TigerCubMascot } from "./GameArtwork";

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
  const ballTop = step < 0 ? 5 : 8 + ((step + 1) / rows) * 70;

  async function drop() {
    if (busyRef.current || !arcadeActions.placeBet(bet)) {
      if (bet > balance) playSound("lose", soundEnabled);
      return;
    }
    busyRef.current = true;
    setLastWin(null);
    setWinningBucket(null);
    playSound("spin", soundEnabled);

    const outcome = dropBall(createRng(), rows);
    setPath(outcome.path);
    setStep(0);
    for (let index = 0; index < rows; index++) {
      setStep(index);
      playSound("tick", soundEnabled);
      await delay(92);
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
    <div className="plinko-machine">
      <section className="plinko-machine__cabinet">
        <div className="plinko-machine__masthead">
          <div className="plinko-brand">
            <span>NEON</span><strong>PLINKO</strong><small>PRIVATE ARCADE</small>
          </div>
          <div className="plinko-jackpots" aria-label="Jackpots fictícios decorativos">
            <div><small>MEGA</small><strong>250.000</strong></div>
            <div><small>MAJOR</small><strong>50.000</strong></div>
            <div><small>MINOR</small><strong>10.000</strong></div>
          </div>
        </div>

        <div className="plinko-board">
          <div className="plinko-city" aria-hidden />
          <div className="plinko-launch-ring" aria-hidden />
          <div className="plinko-pegs" aria-hidden>
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="plinko-peg-row">
                {Array.from({ length: row + 3 }, (_, peg) => <span key={peg} className="plinko-peg" />)}
              </div>
            ))}
          </div>

          <div
            className={cn("plinko-ball", dropping && "plinko-ball--dropping")}
            style={{ left: `${ballLeft}%`, top: `${ballTop}%` }}
            aria-hidden
          ><span /></div>

          <div className="plinko-buckets" style={{ gridTemplateColumns: `repeat(${payouts.length}, minmax(0, 1fr))` }}>
            {payouts.map((value, index) => (
              <div key={`${index}-${value}`} className={cn("plinko-bucket", value >= 10 && "plinko-bucket--high", winningBucket === index && "plinko-bucket--winner")}>
                {value}x
              </div>
            ))}
          </div>
        </div>

        <div className="plinko-result" role="status" aria-live="polite">
          <small>LAST WIN</small>
          <strong>{lastWin ? formatCoins(lastWin.payout) : "0"}</strong>
          <span>{lastWin ? formatMultiplier(lastWin.multiplier) : `${rows} linhas · risco ${RISK_LABELS[risk].toLowerCase()}`}</span>
        </div>

        <div className="plinko-controls">
          <section className="plinko-control-card">
            <small>RISK LEVEL</small>
            <div className="grid grid-cols-3 gap-1.5">
              {(["baixo", "medio", "alto"] as const).map((value) => (
                <Button key={value} size="sm" variant={risk === value ? "gold" : "outline"} disabled={dropping} onClick={() => setRisk(value)} aria-pressed={risk === value}>{RISK_LABELS[value]}</Button>
              ))}
            </div>
          </section>

          <div className="plinko-drop-zone">
            <div className="plinko-mascot-chip" aria-hidden><TigerCubMascot className="w-full" /></div>
            <Button size="lg" variant="gold" className="plinko-drop-button" disabled={dropping || insufficient} onClick={() => void drop()}>
              {dropping ? <CircleDot className="size-6 animate-bounce" aria-hidden /> : <Play className="size-6" aria-hidden />}
              <span>{dropping ? "CAINDO" : "DROP"}</span>
              <small>{dropping ? "aguarde" : "soltar bola"}</small>
            </Button>
          </div>

          <section className="plinko-control-card">
            <small>ROWS</small>
            <div className="grid grid-cols-3 gap-1.5">
              {[12, 14, 16].map((value) => (
                <Button key={value} size="sm" variant={rows === value ? "gold" : "outline"} disabled={dropping} onClick={() => setRows(value)} aria-pressed={rows === value}>{value}</Button>
              ))}
            </div>
          </section>

          <div className="plinko-bet"><BetControls value={bet} onChange={setBet} disabled={dropping} /></div>
        </div>
      </section>

      <p className="game-machine-note"><Sparkles className="inline size-3.5" /> O caminho e o multiplicador continuam definidos antes da animação; o saldo é creditado uma única vez por queda.</p>
    </div>
  );
}
