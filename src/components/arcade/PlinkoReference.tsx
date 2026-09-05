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
import "./PlinkoInteraction.css";

const BALL_COUNTS = [1, 3, 5, 10] as const;
const TRAIL_ECHO_COUNT = 2;
const AUDIO_LAG_BUDGET_MS = 70;
type BallCount = (typeof BALL_COUNTS)[number];
type PortalPhase = "idle" | "charging" | "launching";

type ActiveBall = {
  id: string;
  ballNumber: number;
  path: number[];
  bucket: number;
  multiplier: number;
  payout: number;
  bet: number;
  risk: PlinkoRisk;
  rows: number;
  runBallCount: BallCount;
};

type BoardPoint = { left: number; top: number };
type MotionEntry = { at: number; point: BoardPoint };

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion() ? 0 : ms));

function ballPosition(path: readonly number[], step: number, rows: number, bucket?: number, bucketCount?: number): BoardPoint {
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

function stepDuration(step: number, rows: number) {
  return 58 + Math.round((step / Math.max(1, rows - 1)) * 24);
}

function pointTransform(point: BoardPoint, width: number, height: number, scale = 1) {
  const x = ((point.left - 50) / 100) * width;
  const y = ((point.top - 4.5) / 100) * height;
  return `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate(-50%, -50%) scale(${scale})`;
}

function buildBallMotion(ball: ActiveBall, rows: number, bucketCount: number, width: number, height: number) {
  const initial = ballPosition(ball.path, -1, rows, ball.bucket, bucketCount);
  const entries: MotionEntry[] = [{ at: 0, point: initial }];
  let at = 72;

  for (let step = 0; step < rows; step += 1) {
    entries.push({ at, point: ballPosition(ball.path, step, rows, ball.bucket, bucketCount) });
    at += stepDuration(step, rows);
  }

  entries.push({ at, point: ballPosition(ball.path, rows, rows, ball.bucket, bucketCount) });
  const duration = Math.max(1, at);
  const keyframes: Keyframe[] = entries.map((entry) => ({
    transform: pointTransform(entry.point, width, height),
    offset: entry.at / duration,
  }));
  keyframes[keyframes.length - 1] = {
    transform: pointTransform(entries[entries.length - 1]!.point, width, height),
    offset: 1,
  };
  return { entries, keyframes, duration };
}

function buildImpactKeyframes(entries: readonly MotionEntry[], duration: number, width: number, height: number): Keyframe[] {
  const frames: Keyframe[] = [{ opacity: 0, transform: pointTransform(entries[0]!.point, width, height, .45), offset: 0 }];
  for (let index = 1; index < entries.length - 1; index += 1) {
    const entry = entries[index]!;
    const offset = entry.at / duration;
    const pulse = Math.min(.022, 24 / duration);
    const transform = pointTransform(entry.point, width, height);
    frames.push(
      { opacity: 0, transform: `${transform} scale(.45)`, offset: Math.max(0, offset - .001) },
      { opacity: .9, transform: `${transform} scale(.45)`, offset },
      { opacity: 0, transform: `${transform} scale(1.5)`, offset: Math.min(1, offset + pulse) },
    );
  }
  frames.push({ opacity: 0, transform: pointTransform(entries[entries.length - 1]!.point, width, height, 1), offset: 1 });
  return frames;
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
  const [lastSettledBucket, setLastSettledBucket] = useState<number | null>(null);
  const [landedBuckets, setLandedBuckets] = useState<Set<number>>(() => new Set());
  const [launched, setLaunched] = useState(0);
  const [settled, setSettled] = useState(0);
  const [busy, setBusy] = useState(false);
  const [autoDrop, setAutoDrop] = useState(false);
  const [bigWin, setBigWin] = useState<{ payout: number; multiplier: number } | null>(null);
  const [portalPhase, setPortalPhase] = useState<PortalPhase>("idle");

  const busyRef = useRef(false);
  const autoRef = useRef(false);
  const autoTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const ballRefs = useRef(new Map<string, HTMLDivElement>());
  const trailRefs = useRef(new Map<string, Array<HTMLElement | null>>());
  const impactRefs = useRef(new Map<string, HTMLElement>());
  const collisionRafRef = useRef<number | null>(null);
  const activeAnimationsRef = useRef(new Set<Animation>());
  const pendingSettlementsRef = useRef(new Map<string, ActiveBall>());
  const settledOutcomeIdsRef = useRef(new Set<string>());

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
      if (collisionRafRef.current !== null) {
        window.cancelAnimationFrame(collisionRafRef.current);
        collisionRafRef.current = null;
      }
      for (const animation of activeAnimationsRef.current) animation.cancel();
      activeAnimationsRef.current.clear();
      for (const ball of pendingSettlementsRef.current.values()) settleBallOutcome(ball, false);
      pendingSettlementsRef.current.clear();
      settledOutcomeIdsRef.current.clear();
      busyRef.current = false;
      ballRefs.current.clear();
      trailRefs.current.clear();
      impactRefs.current.clear();
    };
  }, []);

  const payouts = plinkoPayouts(risk, rows);
  const runCost = bet * ballsPerRun;
  const insufficient = runCost > balance;
  const inFlight = Math.max(0, launched - settled);

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

  function resetImperativeMotion() {
    if (collisionRafRef.current !== null) {
      window.cancelAnimationFrame(collisionRafRef.current);
      collisionRafRef.current = null;
    }
    for (const animation of activeAnimationsRef.current) animation.cancel();
    activeAnimationsRef.current.clear();
  }

  function trackAnimation(animation: Animation) {
    activeAnimationsRef.current.add(animation);
    void animation.finished.catch(() => undefined).finally(() => activeAnimationsRef.current.delete(animation));
    return animation;
  }

  function settleBallOutcome(ball: ActiveBall, present = true) {
    if (settledOutcomeIdsRef.current.has(ball.id)) return false;
    settledOutcomeIdsRef.current.add(ball.id);
    pendingSettlementsRef.current.delete(ball.id);

    if (ball.payout > 0) arcadeActions.credit(ball.payout);
    arcadeActions.recordRound({
      slug: "neon-plinko",
      gameName: "Neon Plinko",
      bet: ball.bet,
      payout: ball.payout,
      multiplier: ball.multiplier,
      note: `Bola ${ball.ballNumber}/${ball.runBallCount} · Risco ${RISK_LABELS[ball.risk]} · ${ball.rows} linhas`,
    });

    if (!present || !mountedRef.current) return true;

    setLastSettledBucket(ball.bucket);
    setLandedBuckets((current) => {
      const next = new Set(current);
      next.add(ball.bucket);
      return next;
    });
    setSettled((value) => value + 1);
    setRunWin((value) => value + ball.payout);
    setLastWin({ payout: ball.payout, multiplier: ball.multiplier });
    playSound("plinkoBucket", soundEnabled);

    if (ball.multiplier >= 10) {
      playSound("plinkoHigh", soundEnabled);
      playSound("bigWin", soundEnabled);
    } else {
      playSound(ball.payout >= ball.bet ? "win" : "lose", soundEnabled);
    }
    return true;
  }

  function startAudioScheduler(balls: ActiveBall[], stagger: number) {
    if (reducedMotion()) return;
    const events: number[] = [];
    balls.forEach((_ball, ballIndex) => {
      let at = ballIndex * stagger + 72;
      for (let step = 0; step < rows; step += 1) {
        if (step % 2 === 0 || ballsPerRun <= 3) events.push(at);
        at += stepDuration(step, rows);
      }
    });
    events.sort((a, b) => a - b);

    const startedAt = performance.now();
    let cursor = 0;
    const frame = (now: number) => {
      const elapsed = now - startedAt;
      while (cursor < events.length && events[cursor]! < elapsed - AUDIO_LAG_BUDGET_MS) cursor += 1;
      if (cursor < events.length && events[cursor]! <= elapsed) {
        playSound("plinkoPeg", soundEnabled);
        cursor += 1;
      }
      if (cursor < events.length && mountedRef.current) collisionRafRef.current = requestAnimationFrame(frame);
      else collisionRafRef.current = null;
    };
    collisionRafRef.current = requestAnimationFrame(frame);
  }

  async function animateBall(ball: ActiveBall, launchDelay: number) {
    await wait(launchDelay);
    if (!mountedRef.current) {
      settleBallOutcome(ball, false);
      return ball;
    }

    const element = ballRefs.current.get(ball.id);
    const board = boardRef.current;
    if (!element || !board) {
      settleBallOutcome(ball);
      return ball;
    }
    const rect = board.getBoundingClientRect();
    const tone = ((ball.ballNumber - 1) % 3) + 1;
    const initial = ballPosition(ball.path, -1, rows, ball.bucket, payouts.length);
    const final = ballPosition(ball.path, rows, rows, ball.bucket, payouts.length);
    const motion = buildBallMotion(ball, rows, payouts.length, rect.width, rect.height);

    setLaunched((value) => value + 1);
    element.className = `plinko-ref-ball plinko-ref-ball--falling plinko-ref-ball--tone-${tone}`;
    element.style.transform = pointTransform(initial, rect.width, rect.height);
    element.style.willChange = "transform";
    playSound("plinkoLaunch", soundEnabled);

    if (reducedMotion()) {
      element.style.transform = pointTransform(final, rect.width, rect.height, 1.2);
      element.style.willChange = "auto";
      element.className = `plinko-ref-ball plinko-ref-ball--landed plinko-ref-ball--tone-${tone}`;
      settleBallOutcome(ball);
      return ball;
    }

    const trailNodes = trailRefs.current.get(ball.id) ?? [];
    trailNodes.forEach((node, index) => {
      if (!node) return;
      const echo = trackAnimation(node.animate(
        motion.keyframes.map((frame) => ({ ...frame, opacity: .42 - index * .12 })),
        { duration: motion.duration, delay: 22 * (index + 1), easing: "linear" },
      ));
      echo.playbackRate = 1;
    });

    const impactNode = impactRefs.current.get(ball.id);
    if (impactNode) {
      trackAnimation(impactNode.animate(
        buildImpactKeyframes(motion.entries, motion.duration, rect.width, rect.height),
        { duration: motion.duration, easing: "linear" },
      ));
    }

    const animation = trackAnimation(element.animate(motion.keyframes, {
      duration: motion.duration,
      easing: "linear",
      fill: "forwards",
    }));
    try {
      await animation.finished;
    } catch {
      settleBallOutcome(ball, mountedRef.current);
      return ball;
    }

    if (!mountedRef.current) {
      settleBallOutcome(ball, false);
      return ball;
    }
    element.style.transform = pointTransform(final, rect.width, rect.height, 1.2);
    element.style.willChange = "auto";
    element.className = `plinko-ref-ball plinko-ref-ball--landed plinko-ref-ball--tone-${tone}`;

    settleBallOutcome(ball);
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
    resetImperativeMotion();
    setBusy(true);
    setRunWin(0);
    setLastWin(null);
    setLastSettledBucket(null);
    setLandedBuckets(new Set());
    setBigWin(null);
    setLaunched(0);
    setSettled(0);

    const stamp = Date.now();
    const prepared: ActiveBall[] = [];

    // Resultado, bucket, multiplicador e débito permanecem definidos antes da apresentação.
    for (let ballNumber = 1; ballNumber <= ballsPerRun; ballNumber += 1) {
      if (!arcadeActions.placeBet(bet)) {
        stopAuto();
        break;
      }
      const outcome = dropBall(createRng(), rows);
      const multiplier = payouts[outcome.bucket] ?? 0;
      const ball: ActiveBall = {
        id: `${stamp}-${ballNumber}`,
        ballNumber,
        path: outcome.path,
        bucket: outcome.bucket,
        multiplier,
        payout: Math.round(bet * multiplier),
        bet,
        risk,
        rows,
        runBallCount: ballsPerRun,
      };
      prepared.push(ball);
      pendingSettlementsRef.current.set(ball.id, ball);
    }

    if (!prepared.length) {
      busyRef.current = false;
      setBusy(false);
      return;
    }

    setActiveBalls(prepared);
    setPortalPhase("charging");
    playSound("plinkoPortal", soundEnabled);
    await wait(180);
    if (!mountedRef.current) {
      busyRef.current = false;
      return;
    }
    setPortalPhase("launching");
    await wait(100);
    if (!mountedRef.current) {
      busyRef.current = false;
      return;
    }

    const stagger = ballsPerRun >= 10 ? 88 : ballsPerRun >= 5 ? 108 : 136;
    startAudioScheduler(prepared, stagger);
    const completed = await Promise.all(prepared.map((ball, index) => animateBall(ball, index * stagger)));
    if (!mountedRef.current) {
      busyRef.current = false;
      return;
    }
    setPortalPhase("idle");

    const best = completed.reduce<ActiveBall | null>((current, ball) => (!current || ball.multiplier > current.multiplier ? ball : current), null);
    if (best && best.multiplier >= 10) {
      setBigWin({ payout: best.payout, multiplier: best.multiplier });
      await wait(940);
      if (!mountedRef.current) {
        busyRef.current = false;
        return;
      }
      setBigWin(null);
    } else {
      await wait(460);
      if (!mountedRef.current) {
        busyRef.current = false;
        return;
      }
    }

    resetImperativeMotion();
    for (const ball of prepared) {
      ballRefs.current.delete(ball.id);
      trailRefs.current.delete(ball.id);
      impactRefs.current.delete(ball.id);
    }
    setActiveBalls([]);
    setLandedBuckets(new Set());
    setLaunched(0);
    setSettled(0);
    if (pendingSettlementsRef.current.size === 0) settledOutcomeIdsRef.current.clear();
    busyRef.current = false;
    setBusy(false);

    if (autoRef.current) scheduleAuto(240);
  }

  function moveBet(direction: -1 | 1) {
    const current = Math.max(0, BET_STEPS.indexOf(bet as (typeof BET_STEPS)[number]));
    const next = Math.min(BET_STEPS.length - 1, Math.max(0, current + direction));
    setBet(BET_STEPS[next] ?? bet);
    playSound("click", soundEnabled);
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
          aria-pressed={soundEnabled}
          onClick={() => { arcadeActions.toggleSound(); playSound("click", !soundEnabled); }}
        >
          {soundEnabled ? <Volume2 /> : <VolumeX />}
        </button>

        <div className="plinko-ref-status" aria-live="polite">
          <span>{busy ? `${inFlight} EM QUEDA` : "PRONTO PARA CAIR"}</span>
          <strong>{busy ? `${settled}/${ballsPerRun} CONCLUÍDAS` : `${ballsPerRun} BOLAS`}</strong>
        </div>

        <div ref={boardRef} className="plinko-ref-board" aria-label="Torre Plinko">
          <div className={cn("plinko-ref-board__portal", `is-${portalPhase}`)} aria-hidden><i /><i /></div>

          {activeBalls.map((ball) => {
            const tone = ((ball.ballNumber - 1) % 3) + 1;
            return (
              <div key={ball.id} className="plinko-ref-ball-layer" aria-hidden>
                {Array.from({ length: TRAIL_ECHO_COUNT }, (_, index) => (
                  <i
                    key={`${ball.id}-trail-${index}`}
                    ref={(node) => {
                      const pool = trailRefs.current.get(ball.id) ?? Array.from({ length: TRAIL_ECHO_COUNT }, () => null);
                      pool[index] = node;
                      if (node || pool.some(Boolean)) trailRefs.current.set(ball.id, pool);
                      else trailRefs.current.delete(ball.id);
                    }}
                    className={cn("plinko-ref-trail", "plinko-ref-trail--echo", `plinko-ref-trail--tone-${tone}`)}
                  />
                ))}
                <i
                  ref={(node) => {
                    if (node) impactRefs.current.set(ball.id, node);
                    else impactRefs.current.delete(ball.id);
                  }}
                  className={cn("plinko-ref-impact", "plinko-ref-impact--timeline", `plinko-ref-impact--tone-${tone}`)}
                />
                <div
                  ref={(node) => {
                    if (node) ballRefs.current.set(ball.id, node);
                    else ballRefs.current.delete(ball.id);
                  }}
                  className={cn("plinko-ref-ball", "plinko-ref-ball--queued", `plinko-ref-ball--tone-${tone}`)}
                  style={{ left: "50%", top: "4.5%", zIndex: 20 + (ball.ballNumber % 6) }}
                ><span /></div>
              </div>
            );
          })}

          {!busy && <div className="plinko-ref-ball plinko-ref-ball--idle" style={{ left: "50%", top: "4.5%" }} aria-hidden><span /></div>}

          <div className="plinko-ref-board__payout-mask" aria-hidden />
          <div className="plinko-ref-buckets" style={{ gridTemplateColumns: `repeat(${payouts.length}, minmax(0, 1fr))` }}>
            {payouts.map((value, index) => (
              <div
                key={`${value}-${index}`}
                className={cn(
                  "plinko-ref-bucket",
                  value >= 10 && "is-high",
                  landedBuckets.has(index) && "is-winner",
                  index === lastSettledBucket && "is-latest-winner",
                )}
              >
                <span>{value}×</span>
              </div>
            ))}
          </div>
        </div>

        <section className="plinko-ref-panel plinko-ref-panel--risk" aria-label="Nível de risco">
          <small>RISCO</small>
          <div>{(["baixo", "medio", "alto"] as const).map((value) => <button key={value} type="button" className={cn(risk === value && "is-active")} disabled={busy || autoDrop} onClick={() => { setRisk(value); playSound("click", soundEnabled); }} aria-pressed={risk === value}>{RISK_LABELS[value]}</button>)}</div>
        </section>

        <section className="plinko-ref-panel plinko-ref-panel--rows" aria-label="Quantidade de linhas">
          <small>LINHAS</small>
          <div>{[12, 14, 16].map((value) => <button key={value} type="button" className={cn(rows === value && "is-active")} disabled={busy || autoDrop} onClick={() => { setRows(value); playSound("click", soundEnabled); }} aria-pressed={rows === value}>{value}</button>)}</div>
        </section>

        <section className="plinko-ref-panel plinko-ref-panel--balls" aria-label="Bolas por rodada">
          <small>BOLAS</small>
          <div>{BALL_COUNTS.map((value) => <button key={value} type="button" className={cn(ballsPerRun === value && "is-active")} disabled={busy || autoDrop} onClick={() => { setBallsPerRun(value); playSound("click", soundEnabled); }} aria-pressed={ballsPerRun === value}>{value}</button>)}</div>
        </section>

        <section className="plinko-ref-panel plinko-ref-panel--bet" aria-label="Aposta fictícia">
          <small>APOSTA</small>
          <div className="plinko-ref-bet-row"><button type="button" aria-label="Diminuir aposta" disabled={busy || autoDrop} onClick={() => moveBet(-1)}>−</button><strong>{formatCoins(bet)}</strong><button type="button" aria-label="Aumentar aposta" disabled={busy || autoDrop} onClick={() => moveBet(1)}>+</button></div>
        </section>

        <button type="button" className={cn("plinko-ref-auto", autoDrop && "is-on")} disabled={insufficient && !autoDrop} onClick={toggleAuto} aria-label={autoDrop ? "Desativar Auto Drop" : "Ativar Auto Drop"} aria-pressed={autoDrop}>
          <RotateCw /><span><small>AUTO DROP</small><strong>{autoDrop ? "ATIVO" : "PARADO"}</strong></span><i><b /></i>
        </button>

        <button
          type="button"
          className={cn("plinko-ref-drop", busy && "is-dropping")}
          disabled={busy || insufficient}
          onClick={() => void runSequence()}
          aria-busy={busy}
          aria-label={busy ? "Bolas em queda" : `Soltar ${ballsPerRun} bolas por ${formatCoins(runCost)}`}
        >
          {busy ? <CircleDot /> : <Play />}
          <strong>{busy ? "EM QUEDA" : `SOLTAR ×${ballsPerRun}`}</strong>
          <small>{busy ? `${inFlight} em queda` : formatCoins(runCost)}</small>
        </button>

        <div className="plinko-ref-hud" aria-label="Resumo do jogo">
          <div><Coins /><span><small>SALDO</small><strong>{formatCoins(balance)}</strong></span></div>
          <div><CircleDot /><span><small>CUSTO DA RODADA</small><strong>{formatCoins(runCost)}</strong></span></div>
          <div><Trophy /><span><small>GANHO DA RODADA</small><strong>{formatCoins(runWin)}</strong></span></div>
        </div>

        <div className={cn("plinko-ref-last", lastWin && !busy && "plinko-ref-last--win")} role="status" aria-live="polite">
          <small>{busy ? "RODADA EM ANDAMENTO" : "ÚLTIMO GANHO"}</small>
          <strong>{busy ? formatCoins(runWin) : lastWin ? formatCoins(lastWin.payout) : "0"}</strong>
          <span>{lastWin ? formatMultiplier(lastWin.multiplier) : `${ballsPerRun} BOLAS`}</span>
        </div>

        {bigWin && <div className="plinko-ref-bigwin" role="status"><Zap /><small>SKYFALL HIT</small><strong>BIG WIN</strong><b>{formatMultiplier(bigWin.multiplier)}</b><span>+ {formatCoins(bigWin.payout)}</span></div>}

        <p className="plinko-ref-disclaimer">MOEDAS FICTÍCIAS · SEM VALOR REAL</p>
      </div>
    </div>
  );
}
