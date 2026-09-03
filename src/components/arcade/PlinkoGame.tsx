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
import "./PlinkoPremium.css";

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
  const maxMultiplier = Math.max(...payouts);

  return (
    <div className="plinko-machine plinko-premium" data-risk={risk}>
      <section className="plinko-machine__cabinet plinko-premium__cabinet">
        <div className="plinko-premium__ambient" aria-hidden />
        <div className="plinko-premium__side-light plinko-premium__side-light--left" aria-hidden />
        <div className="plinko-premium__side-light plinko-premium__side-light--right" aria-hidden />

        <div className="plinko-machine__masthead plinko-premium__masthead">
          <div className="plinko-brand plinko-premium__brand">
            <div className="plinko-premium__brand-kicker"><Sparkles /> SKYFALL ARCADE</div>
            <span>NEON</span><strong>PLINKO</strong><small>FORTUNE DROP TOWER</small>
          </div>

          <div className="plinko-jackpots plinko-premium__jackpots" aria-label="Jackpots fictícios decorativos">
            <div><small>MEGA</small><strong>250.000</strong></div>
            <div><small>MAJOR</small><strong>50.000</strong></div>
            <div><small>MINOR</small><strong>10.000</strong></div>
          </div>
        </div>

        <div className="plinko-premium__status-strip" aria-label="Configuração da queda">
          <div><small>RISK</small><strong>{RISK_LABELS[risk]}</strong></div>
          <div><small>ROWS</small><strong>{rows}</strong></div>
          <div><small>MAX</small><strong>{formatMultiplier(maxMultiplier)}</strong></div>
        </div>

        <div className="plinko-board plinko-premium__board">
          <div className="plinko-premium__sky-grid" aria-hidden />
          <div className="plinko-city plinko-premium__city" aria-hidden />
          <div className="plinko-premium__tower-line plinko-premium__tower-line--left" aria-hidden />
          <div className="plinko-premium__tower-line plinko-premium__tower-line--right" aria-hidden />

          <div className="plinko-launch-ring plinko-premium__launch-ring" aria-hidden>
            <span />
          </div>
          <div className="plinko-premium__launch-label" aria-hidden>DROP PORTAL</div>

          <div className="plinko-pegs plinko-premium__pegs" aria-hidden>
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="plinko-peg-row plinko-premium__peg-row">
                {Array.from({ length: row + 3 }, (_, peg) => (
                  <span key={peg} className="plinko-peg plinko-premium__peg"><i /></span>
                ))}
              </div>
            ))}
          </div>

          <div
            className={cn("plinko-ball plinko-premium__ball", dropping && "plinko-ball--dropping plinko-premium__ball--dropping")}
            style={{ left: `${ballLeft}%`, top: `${ballTop}%` }}
            aria-hidden
          ><span /></div>

          <div className="plinko-buckets plinko-premium__buckets" style={{ gridTemplateColumns: `repeat(${payouts.length}, minmax(0, 1fr))` }}>
            {payouts.map((value, index) => (
              <div
                key={`${index}-${value}`}
                className={cn(
                  "plinko-bucket plinko-premium__bucket",
                  value >= 10 && "plinko-bucket--high plinko-premium__bucket--high",
                  winningBucket === index && "plinko-bucket--winner plinko-premium__bucket--winner",
                )}
              >
                <small>{index + 1}</small>
                <strong>{value}×</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="plinko-result plinko-premium__result" role="status" aria-live="polite">
          <div className="plinko-premium__result-label"><small>LAST DROP</small><span>{lastWin ? "SETTLED" : "READY"}</span></div>
          <strong>{lastWin ? formatCoins(lastWin.payout) : "0"}</strong>
          <div className="plinko-premium__result-meta"><span>{lastWin ? formatMultiplier(lastWin.multiplier) : `${rows} linhas`}</span><small>{RISK_LABELS[risk]} RISK</small></div>
        </div>

        <div className="plinko-controls plinko-premium__controls">
          <section className="plinko-control-card plinko-premium__control-card">
            <small>RISK LEVEL</small>
            <div className="grid grid-cols-3 gap-1.5">
              {(["baixo", "medio", "alto"] as const).map((value) => (
                <Button key={value} size="sm" variant={risk === value ? "gold" : "outline"} disabled={dropping} onClick={() => setRisk(value)} aria-pressed={risk === value}>{RISK_LABELS[value]}</Button>
              ))}
            </div>
          </section>

          <div className="plinko-drop-zone plinko-premium__drop-zone">
            <div className="plinko-mascot-chip plinko-premium__mascot-chip" aria-hidden><TigerCubMascot className="w-full" /></div>
            <Button size="lg" variant="gold" className="plinko-drop-button plinko-premium__drop-button" disabled={dropping || insufficient} onClick={() => void drop()}>
              {dropping ? <CircleDot className="size-6 animate-bounce" aria-hidden /> : <Play className="size-6" aria-hidden />}
              <span>{dropping ? "FALLING" : "DROP"}</span>
              <small>{dropping ? "tracking path" : formatCoins(bet)}</small>
            </Button>
          </div>

          <section className="plinko-control-card plinko-premium__control-card">
            <small>TOWER ROWS</small>
            <div className="grid grid-cols-3 gap-1.5">
              {[12, 14, 16].map((value) => (
                <Button key={value} size="sm" variant={rows === value ? "gold" : "outline"} disabled={dropping} onClick={() => setRows(value)} aria-pressed={rows === value}>{value}</Button>
              ))}
            </div>
          </section>

          <div className="plinko-bet plinko-premium__bet"><BetControls value={bet} onChange={setBet} disabled={dropping} /></div>
        </div>
      </section>

      <p className="game-machine-note plinko-premium__note"><Sparkles className="inline size-3.5" /> O caminho e o multiplicador continuam definidos antes da animação; o saldo é creditado uma única vez por queda.</p>
    </div>
  );
}
