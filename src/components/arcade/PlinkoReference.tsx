import { Link } from "@tanstack/react-router";
import { ArrowLeft, CircleDot, Coins, Play, RotateCw, Trophy, Volume2, VolumeX, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import neonPlinkoReference from "@/assets/neon-plinko-reference.webp";
import { formatCoins, formatMultiplier } from "@/lib/arcade/format";
import { dropBall, plinkoPayouts, RISK_LABELS, type PlinkoRisk } from "@/lib/arcade/plinko";
import { createRng } from "@/lib/arcade/rng";
import { BET_STEPS } from "@/lib/arcade/slot-configs";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import "./PlinkoReference.css";

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

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function ballPosition(path: readonly number[], step: number, rows: number, bucket?: number, bucketCount?: number) {
  if (step >= rows && bucket !== undefined && bucketCount) {
    return { left: ((bucket + 0.5) / bucketCount) * 100, top: 87.5 };
  }
  if (step < 0) return { left: 50, top: 4.5 };
  const bounded = Math.min(step, Math.max(0, rows - 1));
  const rights = path.slice(0, bounded + 1).reduce((sum, move) => sum + move, 0);
  return {
    left: 50 + (rights - (bounded + 1) / 2) * (73 / rows),
    top: 8 + ((bounded + 1) / rows) * 72,
  };
}

export function PlinkoReference() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);

  const [bet, setBet] = useState<number>(BET_STEPS[2]);
  const [risk, setRisk] = useState<PlinkoRisk>("medio");
  const [rows, setRows] = useState(14);
  const [ballsPerRun, setBallsPerRun] = useState<BallCount>(3);
  const [activeBalls, setActiveBalls] = useState<ActiveBall[]>([]);
  const [runWin, setRunWin] = useState(0);
  const [lastWin, setLastWin] = useState<{ payout: number; multiplier: number } | null>(null);
  const [launched, setLaunched] = useState(0);
  const [settled, setSettled] = useState(0);
  const [busy, setBusy] = useState(false);
  const [autoDrop, setAutoDrop] = useState(false);
  const [bigWin, setBigWin] = useState<{ payout: number; multiplier: number } | null>(null);

  const busyRef = useRef(false);
  const autoRef = useRef(false);
  const autoTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    hydrateFromStorage();
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      autoRef.current = false;
      if (autoTimerRef.current !== null) {
        window.clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, []);

  const payouts = plinkoPayouts(risk, rows);
  const runCost = bet * ballsPerRun;
  const insufficient = runCost > balance;
  const inFlight = activeBalls.filter((ball) => ball.status === "falling").length;
  const landedBuckets = new Set(activeBalls.filter((ball) => ball.status === "landed").map((ball) => ball.bucket));

  function clearAutoTimer() {
    if (autoTimerRef.current !== null) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }

  function scheduleAuto(delay: number) {
    clearAutoTimer();
    if (!mountedRef.current || !autoRef.current) return;
    autoTimerRef.current = window.setTimeout(() => {
      autoTimerRef.current = null;
      if (mountedRef.current && autoRef.current && !busyRef.current) void runSequence();
    }, delay);
  }

  function stopAuto() {
    autoRef.current = false;
    clearAutoTimer();
    setAutoDrop(false);
  }

  function toggleAuto() {
    const next = !autoRef.current;
    autoRef.current = next;
    setAutoDrop(next);
    playSound("click", soundEnabled);
    if (next && !busyRef.current) scheduleAuto(140);
    if (!next) clearAutoTimer();
  }

  function updateBall(id: string, patch: Partial<ActiveBall>) {
    setActiveBalls((balls) => balls.map((ball) => (ball.id === id ? { ...ball, ...patch } : ball)));
  }

  async function animateBall(ball: ActiveBall, launchDelay: number) {
    await wait(launchDelay);
    setLaunched((value) => value + 1);
    updateBall(ball.id, { status: "falling", step: 0 });
    playSound("spin", soundEnabled);

    for (let step = 0; step < rows; step += 1) {
      updateBall(ball.id, { step });
      if (step % 2 === 0 || ballsPerRun <= 3) playSound("tick", soundEnabled);
      await wait(58 + Math.round((step / Math.max(1, rows - 1)) * 24));
    }

    updateBall(ball.id, { status: "landed", step: rows });
    setSettled((value) => value + 1);
    setRunWin((value) => value + ball.payout);
    setLastWin({ payout: ball.payout, multiplier: ball.multiplier });

    if (ball.payout > 0) arcadeActions.credit(ball.payout);
    arcadeActions.recordRound({
      slug: "neon-plinko",
      gameName: "Neon Plinko",
      bet,
      payout: ball.payout,
      multiplier: ball.multiplier,
      note: `Bola ${ball.ballNumber}/${ballsPerRun} · Risco ${RISK_LABELS[risk]} · ${rows} linhas`,
    });

    playSound(ball.multiplier >= 10 ? "bigWin" : ball.payout >= bet ? "win" : "lose", soundEnabled);
    return ball;
  }

  async function runSequence() {
    if (busyRef.current) return;
    const currentBalance = arcadeActions.getBalance();
    if (runCost > currentBalance) {
      playSound("lose", soundEnabled);
      stopAuto();
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setRunWin(0);
    setLastWin(null);
    setBigWin(null);
    setLaunched(0);
    setSettled(0);

    const stamp = Date.now();
    const prepared: ActiveBall[] = [];

    // Cada resultado e débito é definido antes da primeira animação da sequência.
    for (let ballNumber = 1; ballNumber <= ballsPerRun; ballNumber += 1) {
      if (!arcadeActions.placeBet(bet)) {
        stopAuto();
        break;
      }
      const outcome = dropBall(createRng(), rows);
      const multiplier = payouts[outcome.bucket] ?? 0;
      prepared.push({
        id: `${stamp}-${ballNumber}`,
        ballNumber,
        path: outcome.path,
        step: -1,
        bucket: outcome.bucket,
        multiplier,
        payout: Math.round(bet * multiplier),
        status: "queued",
      });
    }

    if (!prepared.length) {
      busyRef.current = false;
      setBusy(false);
      return;
    }

    setActiveBalls(prepared);
    const stagger = ballsPerRun >= 10 ? 88 : ballsPerRun >= 5 ? 108 : 136;
    const completed = await Promise.all(prepared.map((ball, index) => animateBall(ball, index * stagger)));

    const best = completed.reduce<ActiveBall | null>((current, ball) => (!current || ball.multiplier > current.multiplier ? ball : current), null);
    if (best && best.multiplier >= 10) {
      setBigWin({ payout: best.payout, multiplier: best.multiplier });
      await wait(940);
      setBigWin(null);
    } else {
      await wait(460);
    }

    setActiveBalls([]);
    setLaunched(0);
    setSettled(0);
    busyRef.current = false;
    setBusy(false);

    if (autoRef.current) scheduleAuto(240);
  }

  function moveBet(direction: -1 | 1) {
    const current = Math.max(0, BET_STEPS.indexOf(bet as (typeof BET_STEPS)[number]));
    const next = Math.min(BET_STEPS.length - 1, Math.max(0, current + direction));
    setBet(BET_STEPS[next] ?? bet);
  }

  return (
    <div className="plinko-ref-page">
      <div className={cn("plinko-ref-machine", bigWin && "is-celebrating")}>
        <img className="plinko-ref-machine__art" src={neonPlinkoReference} alt="Neon Plinko Skyfall Tower" draggable={false} />
        <div className="plinko-ref-machine__vignette" aria-hidden />

        <Link to="/" className="plinko-ref-icon plinko-ref-icon--back" aria-label="Voltar ao lobby"><ArrowLeft /></Link>
        <button
          type="button"
          className="plinko-ref-icon plinko-ref-icon--sound"
          aria-label={soundEnabled ? "Desativar som" : "Ativar som"}
          onClick={() => { arcadeActions.toggleSound(); playSound("click", !soundEnabled); }}
        >
          {soundEnabled ? <Volume2 /> : <VolumeX />}
        </button>

        <div className="plinko-ref-status" aria-live="polite">
          <span>{busy ? `${inFlight} EM QUEDA` : "SKYFALL READY"}</span>
          <strong>{busy ? `${settled}/${ballsPerRun} PAGAS` : `${ballsPerRun} BOLAS`}</strong>
        </div>

        <div className="plinko-ref-board" aria-label="Torre Plinko">
          <div className="plinko-ref-board__portal" aria-hidden><i /><i /></div>

          {activeBalls.map((ball) => {
            const position = ballPosition(ball.path, ball.step, rows, ball.bucket, payouts.length);
            const trailStart = Math.max(0, ball.step - 6);
            const trail = ball.status === "falling"
              ? Array.from({ length: Math.max(0, ball.step - trailStart + 1) }, (_, index) => trailStart + index)
              : [];
            const tone = ((ball.ballNumber - 1) % 3) + 1;
            return (
              <div key={ball.id} className="plinko-ref-ball-layer" aria-hidden>
                {trail.map((trailStep, index) => {
                  const point = ballPosition(ball.path, trailStep, rows);
                  return <i key={`${ball.id}-${trailStep}`} className={cn("plinko-ref-trail", `plinko-ref-trail--tone-${tone}`)} style={{ left: `${point.left}%`, top: `${point.top}%`, opacity: (index + 1) / (trail.length + 2) }} />;
                })}
                {ball.status === "falling" && ball.step >= 0 && (
                  <i
                    key={`${ball.id}-impact-${ball.step}`}
                    className={cn("plinko-ref-impact", `plinko-ref-impact--tone-${tone}`)}
                    style={{ left: `${position.left}%`, top: `${Math.min(82, position.top + 1.4)}%` }}
                  />
                )}
                <div
                  className={cn("plinko-ref-ball", `plinko-ref-ball--${ball.status}`, `plinko-ref-ball--tone-${tone}`)}
                  style={{ left: `${position.left}%`, top: `${position.top}%`, zIndex: 20 + (ball.ballNumber % 6) }}
                ><span /></div>
              </div>
            );
          })}

          {!busy && <div className="plinko-ref-ball plinko-ref-ball--idle" style={{ left: "50%", top: "4.5%" }} aria-hidden><span /></div>}

          <div className="plinko-ref-board__payout-mask" aria-hidden />
          <div className="plinko-ref-buckets" style={{ gridTemplateColumns: `repeat(${payouts.length}, minmax(0, 1fr))` }}>
            {payouts.map((value, index) => (
              <div key={`${value}-${index}`} className={cn("plinko-ref-bucket", value >= 10 && "is-high", landedBuckets.has(index) && "is-winner")}>
                <span>{value}×</span>
              </div>
            ))}
          </div>
        </div>

        <section className="plinko-ref-panel plinko-ref-panel--risk" aria-label="Nível de risco">
          <small>RISK</small>
          <div>{(["baixo", "medio", "alto"] as const).map((value) => <button key={value} type="button" className={cn(risk === value && "is-active")} disabled={busy || autoDrop} onClick={() => setRisk(value)}>{RISK_LABELS[value]}</button>)}</div>
        </section>

        <section className="plinko-ref-panel plinko-ref-panel--rows" aria-label="Quantidade de linhas">
          <small>ROWS</small>
          <div>{[12, 14, 16].map((value) => <button key={value} type="button" className={cn(rows === value && "is-active")} disabled={busy || autoDrop} onClick={() => setRows(value)}>{value}</button>)}</div>
        </section>

        <section className="plinko-ref-panel plinko-ref-panel--balls" aria-label="Bolas por rodada">
          <small>BALLS</small>
          <div>{BALL_COUNTS.map((value) => <button key={value} type="button" className={cn(ballsPerRun === value && "is-active")} disabled={busy || autoDrop} onClick={() => setBallsPerRun(value)}>{value}</button>)}</div>
        </section>

        <section className="plinko-ref-panel plinko-ref-panel--bet" aria-label="Aposta fictícia">
          <small>BET</small>
          <div className="plinko-ref-bet-row"><button disabled={busy || autoDrop} onClick={() => moveBet(-1)}>−</button><strong>{formatCoins(bet)}</strong><button disabled={busy || autoDrop} onClick={() => moveBet(1)}>+</button></div>
        </section>

        <button type="button" className={cn("plinko-ref-auto", autoDrop && "is-on")} disabled={insufficient && !autoDrop} onClick={toggleAuto} aria-pressed={autoDrop}>
          <RotateCw /><span><small>AUTO</small><strong>{autoDrop ? "ON" : "OFF"}</strong></span><i><b /></i>
        </button>

        <button type="button" className="plinko-ref-drop" disabled={busy || insufficient} onClick={() => void runSequence()}>
          {busy ? <CircleDot className="animate-bounce" /> : <Play />}
          <strong>{busy ? "MULTI DROP" : `DROP ×${ballsPerRun}`}</strong>
          <small>{busy ? `${inFlight} in flight` : formatCoins(runCost)}</small>
        </button>

        <div className="plinko-ref-hud" aria-label="Resumo do jogo">
          <div><Coins /><span><small>BALANCE</small><strong>{formatCoins(balance)}</strong></span></div>
          <div><CircleDot /><span><small>RUN BET</small><strong>{formatCoins(runCost)}</strong></span></div>
          <div><Trophy /><span><small>RUN WIN</small><strong>{formatCoins(runWin)}</strong></span></div>
        </div>

        <div className="plinko-ref-last" role="status" aria-live="polite">
          <small>{busy ? "MULTI-BALL" : "LAST WIN"}</small>
          <strong>{busy ? formatCoins(runWin) : lastWin ? formatCoins(lastWin.payout) : "0"}</strong>
          <span>{lastWin ? formatMultiplier(lastWin.multiplier) : `${ballsPerRun} BALLS`}</span>
        </div>

        {bigWin && <div className="plinko-ref-bigwin" role="status"><Zap /><small>SKYFALL HIT</small><strong>BIG WIN</strong><b>{formatMultiplier(bigWin.multiplier)}</b><span>+ {formatCoins(bigWin.payout)}</span></div>}

        <p className="plinko-ref-disclaimer">MOEDAS FICTÍCIAS · SEM VALOR REAL</p>
      </div>
    </div>
  );
}