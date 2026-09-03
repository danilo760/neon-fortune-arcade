import { CircleDot, Coins, Play, RotateCw, Sparkles, Trophy, Zap } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import neonPlinkoReference from "@/assets/neon-plinko-reference.webp";
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

function getBallPosition(path: readonly number[], step: number, rows: number) {
  if (step < 0) return { left: 50, top: 5 };
  const boundedStep = Math.min(step, Math.max(0, rows - 1));
  const rights = path.slice(0, boundedStep + 1).reduce((sum, move) => sum + move, 0);
  return {
    left: 50 + (rights - (boundedStep + 1) / 2) * (72 / rows),
    top: 9 + ((boundedStep + 1) / rows) * 68,
  };
}

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
  const [busy, setBusy] = useState(false);
  const [autoDrop, setAutoDrop] = useState(false);
  const [bigWin, setBigWin] = useState<{ payout: number; multiplier: number } | null>(null);
  const busyRef = useRef(false);
  const autoDropRef = useRef(false);

  const payouts = plinkoPayouts(risk, rows);
  const dropping = busy && step >= 0 && step < rows;
  const maxMultiplier = Math.max(...payouts);
  const insufficient = bet > balance;

  const currentPosition =
    step === rows && winningBucket !== null
      ? { left: ((winningBucket + 0.5) / payouts.length) * 100, top: 86.3 }
      : getBallPosition(path, step, rows);

  const trailStart = Math.max(0, step - 6);
  const trailSteps = dropping
    ? Array.from({ length: Math.max(0, step - trailStart + 1) }, (_, index) => trailStart + index)
    : [];

  function stopAutoDrop() {
    autoDropRef.current = false;
    setAutoDrop(false);
  }

  function toggleAutoDrop() {
    const next = !autoDropRef.current;
    autoDropRef.current = next;
    setAutoDrop(next);
    if (next && !busyRef.current) window.setTimeout(() => void drop(), 120);
  }

  async function drop() {
    if (busyRef.current) return;
    if (!arcadeActions.placeBet(bet)) {
      if (bet > balance) playSound("lose", soundEnabled);
      stopAutoDrop();
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setBigWin(null);
    setLastWin(null);
    setWinningBucket(null);
    playSound("spin", soundEnabled);

    // O resultado é definido antes da animação. A queda apenas revela o caminho já sorteado.
    const outcome = dropBall(createRng(), rows);
    setPath(outcome.path);
    setStep(0);

    for (let index = 0; index < rows; index += 1) {
      setStep(index);
      playSound("tick", soundEnabled);
      await delay(68 + Math.round((index / Math.max(1, rows - 1)) * 32));
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

    const isBigWin = multiplier >= 10 || payout >= bet * 10;
    if (isBigWin) setBigWin({ payout, multiplier });
    playSound(isBigWin ? "bigWin" : payout >= bet ? "win" : "lose", soundEnabled);

    await delay(isBigWin ? 1150 : 620);
    setBigWin(null);
    setStep(-1);
    busyRef.current = false;
    setBusy(false);

    if (autoDropRef.current) window.setTimeout(() => void drop(), 340);
  }

  return (
    <div className="plinko-machine plinko-premium" data-risk={risk}>
      <section className="plinko-machine__cabinet plinko-premium__cabinet">
        <img className="plinko-premium__machine-art" src={neonPlinkoReference} alt="" aria-hidden />
        <div className="plinko-premium__ambient" aria-hidden />
        <div className="plinko-premium__side-light plinko-premium__side-light--left" aria-hidden />
        <div className="plinko-premium__side-light plinko-premium__side-light--right" aria-hidden />

        <header className="plinko-machine__masthead plinko-premium__masthead">
          <div className="plinko-brand plinko-premium__brand">
            <div className="plinko-premium__brand-kicker"><Sparkles /> SKYFALL TOWER</div>
            <span>NEON</span><strong>PLINKO</strong><small>PRIVATE ARCADE</small>
          </div>

          <div className="plinko-jackpots plinko-premium__jackpots" aria-label="Jackpots fictícios decorativos">
            <div><small>MEGA</small><strong>250.000</strong></div>
            <div><small>MAJOR</small><strong>50.000</strong></div>
            <div><small>MINOR</small><strong>10.000</strong></div>
          </div>
        </header>

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

          <div className="plinko-launch-ring plinko-premium__launch-ring" aria-hidden><span /></div>
          <div className="plinko-premium__launch-label" aria-hidden>DROP PORTAL</div>

          <div className="plinko-pegs plinko-premium__pegs" aria-hidden>
            {Array.from({ length: rows }, (_, row) => (
              <div
                key={row}
                className={cn(
                  "plinko-peg-row plinko-premium__peg-row",
                  dropping && row === step && "plinko-premium__peg-row--hit",
                )}
              >
                {Array.from({ length: row + 3 }, (_, peg) => (
                  <span key={peg} className="plinko-peg plinko-premium__peg"><i /></span>
                ))}
              </div>
            ))}
          </div>

          <div className="plinko-premium__trail" aria-hidden>
            {trailSteps.map((trailStep, index) => {
              const position = getBallPosition(path, trailStep, rows);
              return (
                <span
                  key={trailStep}
                  style={{
                    left: `${position.left}%`,
                    top: `${position.top}%`,
                    opacity: (index + 1) / (trailSteps.length + 2),
                  }}
                />
              );
            })}
          </div>

          <div
            className={cn(
              "plinko-ball plinko-premium__ball",
              dropping && "plinko-ball--dropping plinko-premium__ball--dropping",
              step === rows && "plinko-premium__ball--landed",
            )}
            style={{ left: `${currentPosition.left}%`, top: `${currentPosition.top}%` }}
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

          {bigWin && (
            <div className="plinko-premium__big-win" role="status" aria-live="assertive">
              <Zap aria-hidden />
              <small>SKYFALL HIT</small>
              <strong>BIG WIN</strong>
              <b>{formatMultiplier(bigWin.multiplier)}</b>
              <span>+ {formatCoins(bigWin.payout)}</span>
            </div>
          )}
        </div>

        <div className="plinko-result plinko-premium__result" role="status" aria-live="polite">
          <div className="plinko-premium__result-label"><small>LAST DROP</small><span>{lastWin ? "SETTLED" : busy ? "IN FLIGHT" : "READY"}</span></div>
          <strong>{lastWin ? formatCoins(lastWin.payout) : "0"}</strong>
          <div className="plinko-premium__result-meta"><span>{lastWin ? formatMultiplier(lastWin.multiplier) : `${rows} linhas`}</span><small>{RISK_LABELS[risk]} RISK</small></div>
        </div>

        <div className="plinko-controls plinko-premium__controls">
          <section className="plinko-control-card plinko-premium__control-card">
            <small>RISK LEVEL</small>
            <div className="grid grid-cols-3 gap-1.5">
              {(["baixo", "medio", "alto"] as const).map((value) => (
                <Button key={value} size="sm" variant={risk === value ? "gold" : "outline"} disabled={busy || autoDrop} onClick={() => setRisk(value)} aria-pressed={risk === value}>{RISK_LABELS[value]}</Button>
              ))}
            </div>
          </section>

          <div className="plinko-drop-zone plinko-premium__drop-zone">
            <div className="plinko-mascot-chip plinko-premium__mascot-chip" aria-hidden><TigerCubMascot className="w-full" /></div>
            <Button size="lg" variant="gold" className="plinko-drop-button plinko-premium__drop-button" disabled={busy || insufficient} onClick={() => void drop()}>
              {dropping ? <CircleDot className="size-6 animate-bounce" aria-hidden /> : <Play className="size-6" aria-hidden />}
              <span>{dropping ? "FALLING" : "DROP"}</span>
              <small>{dropping ? "tracking path" : formatCoins(bet)}</small>
            </Button>
          </div>

          <section className="plinko-control-card plinko-premium__control-card">
            <small>TOWER ROWS</small>
            <div className="grid grid-cols-3 gap-1.5">
              {[12, 14, 16].map((value) => (
                <Button key={value} size="sm" variant={rows === value ? "gold" : "outline"} disabled={busy || autoDrop} onClick={() => setRows(value)} aria-pressed={rows === value}>{value}</Button>
              ))}
            </div>
          </section>

          <div className="plinko-premium__utility-row">
            <div className="plinko-bet plinko-premium__bet"><BetControls value={bet} onChange={setBet} disabled={busy || autoDrop} /></div>
            <button
              type="button"
              className={cn("plinko-premium__auto", autoDrop && "is-on")}
              onClick={toggleAutoDrop}
              disabled={insufficient && !autoDrop}
              aria-pressed={autoDrop}
            >
              <RotateCw aria-hidden />
              <span><small>AUTO DROP</small><strong>{autoDrop ? "ON" : "OFF"}</strong></span>
              <i aria-hidden><b /></i>
            </button>
          </div>

          <div className="plinko-premium__hud" aria-label="Resumo da rodada">
            <div><Coins aria-hidden /><span><small>BALANCE</small><strong>{formatCoins(balance)}</strong></span></div>
            <div><CircleDot aria-hidden /><span><small>TOTAL BET</small><strong>{formatCoins(bet)}</strong></span></div>
            <div><Trophy aria-hidden /><span><small>LAST WIN</small><strong>{lastWin ? formatCoins(lastWin.payout) : "0"}</strong></span></div>
          </div>
        </div>
      </section>

      <p className="game-machine-note plinko-premium__note"><Sparkles className="inline size-3.5" /> O caminho e o multiplicador continuam definidos antes da animação; o saldo é creditado uma única vez por queda.</p>
    </div>
  );
}
