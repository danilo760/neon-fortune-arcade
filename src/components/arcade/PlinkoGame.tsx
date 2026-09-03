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
import "./PlinkoMobile.css";

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const BALL_COUNTS = [1, 3, 5, 10] as const;

type BallCount = (typeof BALL_COUNTS)[number];
type BallStatus = "queued" | "falling" | "landed";

type ActiveBall = {
  id: string;
  ballNumber: number;
  path: number[];
  step: number;
  bucket: number;
  multiplier: number;
  payout: number;
  status: BallStatus;
};

function getBallPosition(path: readonly number[], step: number, rows: number) {
  if (step < 0) return { left: 50, top: 5 };
  const boundedStep = Math.min(step, Math.max(0, rows - 1));
  const rights = path.slice(0, boundedStep + 1).reduce((sum, move) => sum + move, 0);
  return {
    left: 50 + (rights - (boundedStep + 1) / 2) * (72 / rows),
    top: 9 + ((boundedStep + 1) / rows) * 68,
  };
}

function getRenderedBallPosition(ball: ActiveBall, rows: number, bucketCount: number) {
  if (ball.status === "landed") {
    return { left: ((ball.bucket + 0.5) / bucketCount) * 100, top: 86.3 };
  }
  return getBallPosition(ball.path, ball.step, rows);
}

export function PlinkoGame() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const [bet, setBet] = useState<number>(BET_STEPS[2]);
  const [risk, setRisk] = useState<PlinkoRisk>("medio");
  const [rows, setRows] = useState(14);
  const [ballsPerRun, setBallsPerRun] = useState<BallCount>(3);
  const [activeBalls, setActiveBalls] = useState<ActiveBall[]>([]);
  const [lastWin, setLastWin] = useState<{ payout: number; multiplier: number } | null>(null);
  const [runWin, setRunWin] = useState(0);
  const [launchedBalls, setLaunchedBalls] = useState(0);
  const [settledBalls, setSettledBalls] = useState(0);
  const [busy, setBusy] = useState(false);
  const [autoDrop, setAutoDrop] = useState(false);
  const [bigWin, setBigWin] = useState<{ payout: number; multiplier: number } | null>(null);
  const busyRef = useRef(false);
  const autoDropRef = useRef(false);

  const payouts = plinkoPayouts(risk, rows);
  const maxMultiplier = Math.max(...payouts);
  const runCost = bet * ballsPerRun;
  const insufficient = runCost > balance;
  const dropping = activeBalls.some((ball) => ball.status === "falling");
  const activeCount = activeBalls.filter((ball) => ball.status === "falling").length;
  const landedBuckets = new Set(
    activeBalls.filter((ball) => ball.status === "landed").map((ball) => ball.bucket),
  );
  const hitRows = new Set(
    activeBalls.filter((ball) => ball.status === "falling" && ball.step >= 0).map((ball) => ball.step),
  );

  function stopAutoDrop() {
    autoDropRef.current = false;
    setAutoDrop(false);
  }

  function toggleAutoDrop() {
    const next = !autoDropRef.current;
    autoDropRef.current = next;
    setAutoDrop(next);
    if (next && !busyRef.current) window.setTimeout(() => void runDropSequence(), 120);
  }

  function updateBall(id: string, patch: Partial<ActiveBall>) {
    setActiveBalls((balls) => balls.map((ball) => (ball.id === id ? { ...ball, ...patch } : ball)));
  }

  async function animatePreparedBall(ball: ActiveBall, launchDelay: number) {
    await delay(launchDelay);
    setLaunchedBalls((value) => value + 1);
    updateBall(ball.id, { status: "falling", step: 0 });
    playSound("spin", soundEnabled);

    for (let index = 0; index < rows; index += 1) {
      updateBall(ball.id, { step: index });
      if (index % 2 === 0 || ballsPerRun <= 3) playSound("tick", soundEnabled);
      await delay(64 + Math.round((index / Math.max(1, rows - 1)) * 24));
    }

    updateBall(ball.id, { status: "landed", step: rows });
    setLastWin({ payout: ball.payout, multiplier: ball.multiplier });
    setSettledBalls((value) => value + 1);
    setRunWin((value) => value + ball.payout);

    if (ball.payout > 0) arcadeActions.credit(ball.payout);
    arcadeActions.recordRound({
      slug: "neon-plinko",
      gameName: "Neon Plinko",
      bet,
      payout: ball.payout,
      multiplier: ball.multiplier,
      note: `Bola ${ball.ballNumber}/${ballsPerRun} · Risco ${RISK_LABELS[risk]} · ${rows} linhas`,
    });

    const isBigWin = ball.multiplier >= 10 || ball.payout >= bet * 10;
    playSound(isBigWin ? "bigWin" : ball.payout >= bet ? "win" : "lose", soundEnabled);

    return ball;
  }

  async function runDropSequence() {
    if (busyRef.current) return;
    if (runCost > balance) {
      playSound("lose", soundEnabled);
      stopAutoDrop();
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setBigWin(null);
    setRunWin(0);
    setLaunchedBalls(0);
    setSettledBalls(0);
    setLastWin(null);

    const sequenceStamp = Date.now();
    const preparedBalls: ActiveBall[] = [];

    // Todas as bolas da sequência são debitadas e têm seus resultados definidos ANTES da primeira animação.
    // Isso garante múltiplas bolas reais no tabuleiro sem alterar a liquidação de cada queda.
    for (let ballNumber = 1; ballNumber <= ballsPerRun; ballNumber += 1) {
      if (!arcadeActions.placeBet(bet)) {
        stopAutoDrop();
        break;
      }

      const outcome = dropBall(createRng(), rows);
      const multiplier = payouts[outcome.bucket] ?? 0;
      preparedBalls.push({
        id: `${sequenceStamp}-${ballNumber}`,
        ballNumber,
        path: outcome.path,
        step: -1,
        bucket: outcome.bucket,
        multiplier,
        payout: Math.round(bet * multiplier),
        status: "queued",
      });
    }

    if (preparedBalls.length === 0) {
      busyRef.current = false;
      setBusy(false);
      return;
    }

    setActiveBalls(preparedBalls);

    // Stagger curto: a segunda bola entra antes de a primeira terminar, criando multi-bola simultânea de verdade.
    const staggerMs = ballsPerRun >= 10 ? 92 : ballsPerRun >= 5 ? 112 : 138;
    const settled = await Promise.all(
      preparedBalls.map((ball, index) => animatePreparedBall(ball, index * staggerMs)),
    );

    const biggest = settled.reduce<ActiveBall | null>(
      (best, ball) => (!best || ball.multiplier > best.multiplier ? ball : best),
      null,
    );
    if (biggest && (biggest.multiplier >= 10 || biggest.payout >= bet * 10)) {
      setBigWin({ payout: biggest.payout, multiplier: biggest.multiplier });
      await delay(800);
      setBigWin(null);
    } else {
      await delay(420);
    }

    setActiveBalls([]);
    setLaunchedBalls(0);
    setSettledBalls(0);
    busyRef.current = false;
    setBusy(false);

    if (autoDropRef.current) {
      window.setTimeout(() => void runDropSequence(), 260);
    }
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

          <div className="plinko-premium__ball-queue" aria-label={`${ballsPerRun} bolas por sequência`}>
            {Array.from({ length: Math.min(ballsPerRun, 10) }, (_, index) => {
              const number = index + 1;
              const ball = activeBalls.find((item) => item.ballNumber === number);
              return (
                <i
                  key={index}
                  className={cn(
                    ball?.status === "landed" && "is-played",
                    ball?.status === "falling" && "is-active",
                  )}
                />
              );
            })}
          </div>

          {busy && (
            <div className="plinko-premium__ball-counter" role="status">
              {activeCount > 0 ? `${activeCount} BALL${activeCount > 1 ? "S" : ""} IN FLIGHT` : `${settledBalls}/${ballsPerRun} SETTLED`}
            </div>
          )}

          <div className="plinko-pegs plinko-premium__pegs" aria-hidden>
            {Array.from({ length: rows }, (_, row) => (
              <div
                key={row}
                className={cn(
                  "plinko-peg-row plinko-premium__peg-row",
                  hitRows.has(row) && "plinko-premium__peg-row--hit",
                )}
              >
                {Array.from({ length: row + 3 }, (_, peg) => (
                  <span key={peg} className="plinko-peg plinko-premium__peg"><i /></span>
                ))}
              </div>
            ))}
          </div>

          {activeBalls.map((ball) => {
            const currentPosition = getRenderedBallPosition(ball, rows, payouts.length);
            const trailStart = Math.max(0, ball.step - 5);
            const trailSteps = ball.status === "falling"
              ? Array.from({ length: Math.max(0, ball.step - trailStart + 1) }, (_, index) => trailStart + index)
              : [];

            return (
              <div key={ball.id} className="plinko-premium__multi-ball-layer" aria-hidden>
                <div className="plinko-premium__trail">
                  {trailSteps.map((trailStep, index) => {
                    const position = getBallPosition(ball.path, trailStep, rows);
                    return (
                      <span
                        key={`${ball.id}-${trailStep}`}
                        style={{
                          left: `${position.left}%`,
                          top: `${position.top}%`,
                          opacity: ((index + 1) / (trailSteps.length + 2)) * 0.9,
                        }}
                      />
                    );
                  })}
                </div>

                <div
                  className={cn(
                    "plinko-ball plinko-premium__ball plinko-premium__ball--multi",
                    ball.status === "queued" && "plinko-premium__ball--queued",
                    ball.status === "falling" && "plinko-ball--dropping plinko-premium__ball--dropping",
                    ball.status === "landed" && "plinko-premium__ball--landed",
                  )}
                  style={{
                    left: `${currentPosition.left}%`,
                    top: `${currentPosition.top}%`,
                    zIndex: 12 + (ball.ballNumber % 4),
                  }}
                ><span /></div>
              </div>
            );
          })}

          {!busy && activeBalls.length === 0 && (
            <div
              className="plinko-ball plinko-premium__ball plinko-premium__ball--idle"
              style={{ left: "50%", top: "5%" }}
              aria-hidden
            ><span /></div>
          )}

          <div className="plinko-buckets plinko-premium__buckets" style={{ gridTemplateColumns: `repeat(${payouts.length}, minmax(0, 1fr))` }}>
            {payouts.map((value, index) => (
              <div
                key={`${index}-${value}`}
                className={cn(
                  "plinko-bucket plinko-premium__bucket",
                  value >= 10 && "plinko-bucket--high plinko-premium__bucket--high",
                  landedBuckets.has(index) && "plinko-bucket--winner plinko-premium__bucket--winner",
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
          <div className="plinko-premium__result-label">
            <small>{busy ? "MULTI-BALL RUN" : "LAST DROP"}</small>
            <span>{busy ? `${settledBalls}/${ballsPerRun} SETTLED` : lastWin ? "SETTLED" : "READY"}</span>
          </div>
          <strong>{busy ? formatCoins(runWin) : lastWin ? formatCoins(lastWin.payout) : "0"}</strong>
          <div className="plinko-premium__result-meta">
            <span>{busy ? `${launchedBalls}/${ballsPerRun} launched` : lastWin ? formatMultiplier(lastWin.multiplier) : `${ballsPerRun} bola${ballsPerRun > 1 ? "s" : ""}`}</span>
            <small>{RISK_LABELS[risk]} RISK</small>
          </div>
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
            <Button size="lg" variant="gold" className="plinko-drop-button plinko-premium__drop-button" disabled={busy || insufficient} onClick={() => void runDropSequence()}>
              {dropping ? <CircleDot className="size-6 animate-bounce" aria-hidden /> : <Play className="size-6" aria-hidden />}
              <span>{busy ? "MULTI DROP" : `DROP ×${ballsPerRun}`}</span>
              <small>{busy ? `${activeCount} in flight` : formatCoins(runCost)}</small>
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

          <section className="plinko-premium__ball-selector" aria-label="Quantidade de bolas por sequência">
            <small>BALLS PER RUN</small>
            <div>
              {BALL_COUNTS.map((count) => (
                <button
                  key={count}
                  type="button"
                  className={cn(ballsPerRun === count && "is-active")}
                  onClick={() => setBallsPerRun(count)}
                  disabled={busy || autoDrop}
                  aria-pressed={ballsPerRun === count}
                >
                  {count}
                </button>
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
            <div><CircleDot aria-hidden /><span><small>RUN BET</small><strong>{formatCoins(runCost)}</strong></span></div>
            <div><Trophy aria-hidden /><span><small>RUN WIN</small><strong>{formatCoins(runWin)}</strong></span></div>
          </div>
        </div>
      </section>

      <p className="game-machine-note plinko-premium__note"><Sparkles className="inline size-3.5" /> As bolas da sequência têm resultados definidos antes da animação, descem simultaneamente e cada uma é liquidada exatamente uma vez.</p>
    </div>
  );
}
