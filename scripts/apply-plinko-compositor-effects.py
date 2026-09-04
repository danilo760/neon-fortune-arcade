from pathlib import Path

path = Path("src/components/arcade/PlinkoReference.tsx")
text = path.read_text()

text = text.replace(
'''const IMPACT_POOL_SIZE = 12;
const TRAIL_POOL_SIZE = 6;
const MAX_COLLISIONS_PER_FRAME = 4;
const TRAIL_LAG_BUDGET_MS = 34;
''',
'''const TRAIL_ECHO_COUNT = 2;
const AUDIO_LAG_BUDGET_MS = 70;
''',
1,
)
text = text.replace(
'''type BoardPoint = { left: number; top: number };
type CollisionEvent = { at: number; ball: ActiveBall; step: number };
''',
'''type BoardPoint = { left: number; top: number };
type MotionEntry = { at: number; point: BoardPoint };
''',
1,
)
text = text.replace(
'''  const entries: Array<{ at: number; point: BoardPoint }> = [{ at: 0, point: initial }];
''',
'''  const entries: MotionEntry[] = [{ at: 0, point: initial }];
''',
1,
)
text = text.replace(
'''  return { keyframes, duration };
}

export function PlinkoReference() {
''',
'''  return { entries, keyframes, duration };
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
''',
1,
)

old_refs = '''  const ballRefs = useRef(new Map<string, HTMLDivElement>());
  const trailRefs = useRef(new Map<string, Array<HTMLElement | null>>());
  const trailCursorRef = useRef(new Map<string, number>());
  const impactRefs = useRef<Array<HTMLElement | null>>([]);
  const impactCursorRef = useRef(0);
  const collisionRafRef = useRef<number | null>(null);
  const activeAnimationsRef = useRef(new Set<Animation>());
'''
new_refs = '''  const ballRefs = useRef(new Map<string, HTMLDivElement>());
  const trailRefs = useRef(new Map<string, Array<HTMLElement | null>>());
  const impactRefs = useRef(new Map<string, HTMLElement>());
  const collisionRafRef = useRef<number | null>(null);
  const activeAnimationsRef = useRef(new Set<Animation>());
'''
if old_refs not in text:
    raise SystemExit("refs marker missing")
text = text.replace(old_refs, new_refs, 1)

text = text.replace(
'''      trailRefs.current.clear();
      trailCursorRef.current.clear();
''',
'''      trailRefs.current.clear();
      impactRefs.current.clear();
''',
1,
)

start = text.index("  function resetImperativeMotion() {")
end = text.index("  async function animateBall", start)
replacement = '''  function resetImperativeMotion() {
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

  function startAudioScheduler(balls: ActiveBall[], stagger: number) {
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

'''
text = text[:start] + replacement + text[end:]

old_motion = '''    const motion = buildBallMotion(ball, rows, payouts.length, rect.width, rect.height);

    setLaunched((value) => value + 1);
    element.className = `plinko-ref-ball plinko-ref-ball--falling plinko-ref-ball--tone-${tone}`;
    element.style.transform = pointTransform(initial, rect.width, rect.height);
    element.style.willChange = "transform";
    playSound("plinkoLaunch", soundEnabled);

    const animation = element.animate(motion.keyframes, {
      duration: motion.duration,
      easing: "linear",
      fill: "forwards",
    });
    activeAnimationsRef.current.add(animation);
    try {
      await animation.finished;
    } catch {
      return ball;
    } finally {
      activeAnimationsRef.current.delete(animation);
    }
'''
new_motion = '''    const motion = buildBallMotion(ball, rows, payouts.length, rect.width, rect.height);

    setLaunched((value) => value + 1);
    element.className = `plinko-ref-ball plinko-ref-ball--falling plinko-ref-ball--tone-${tone}`;
    element.style.transform = pointTransform(initial, rect.width, rect.height);
    element.style.willChange = "transform";
    playSound("plinkoLaunch", soundEnabled);

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
      return ball;
    }
'''
if old_motion not in text:
    raise SystemExit("ball motion marker missing")
text = text.replace(old_motion, new_motion, 1)

text = text.replace("    startCollisionScheduler(prepared, stagger);", "    startAudioScheduler(prepared, stagger);", 1)

old_render = '''                {Array.from({ length: TRAIL_POOL_SIZE }, (_, index) => (
                  <i
                    key={`${ball.id}-trail-${index}`}
                    ref={(node) => {
                      const pool = trailRefs.current.get(ball.id) ?? Array.from({ length: TRAIL_POOL_SIZE }, () => null);
                      pool[index] = node;
                      trailRefs.current.set(ball.id, pool);
                    }}
                    className={cn("plinko-ref-trail", "plinko-ref-trail--pooled", `plinko-ref-trail--tone-${tone}`)}
                  />
                ))}
                <div
'''
new_render = '''                {Array.from({ length: TRAIL_ECHO_COUNT }, (_, index) => (
                  <i
                    key={`${ball.id}-trail-${index}`}
                    ref={(node) => {
                      const pool = trailRefs.current.get(ball.id) ?? Array.from({ length: TRAIL_ECHO_COUNT }, () => null);
                      pool[index] = node;
                      trailRefs.current.set(ball.id, pool);
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
'''
if old_render not in text:
    raise SystemExit("trail render marker missing")
text = text.replace(old_render, new_render, 1)

impact_pool_start = text.index('          {Array.from({ length: IMPACT_POOL_SIZE }')
impact_pool_end = text.index('\n\n          {!busy &&', impact_pool_start)
text = text[:impact_pool_start] + text[impact_pool_end:]

path.write_text(text)

css_path = Path("src/components/arcade/PlinkoInteraction.css")
css = css_path.read_text()
css = css.replace(
'''.plinko-ref-trail--pooled,
.plinko-ref-impact--pooled {
  left: 50%;
  top: 4.5%;
  opacity: 0;
  animation: none;
  pointer-events: none;
}
''',
'''.plinko-ref-trail--echo,
.plinko-ref-impact--timeline {
  left: 50%;
  top: 4.5%;
  opacity: 0;
  animation: none;
  pointer-events: none;
  will-change: transform, opacity;
}
''',
1,
)
css_path.write_text(css)
