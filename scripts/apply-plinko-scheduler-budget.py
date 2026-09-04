from pathlib import Path

path = Path("src/components/arcade/PlinkoReference.tsx")
text = path.read_text()

old_const = "const TRAIL_POOL_SIZE = 6;\n"
new_const = "const TRAIL_POOL_SIZE = 6;\nconst MAX_COLLISIONS_PER_FRAME = 4;\nconst TRAIL_LAG_BUDGET_MS = 34;\n"
if "MAX_COLLISIONS_PER_FRAME" not in text:
    if old_const not in text:
        raise SystemExit("pool constant marker missing")
    text = text.replace(old_const, new_const, 1)

old = '''    const startedAt = performance.now();
    let cursor = 0;
    const frame = (now: number) => {
      const elapsed = now - startedAt;
      while (cursor < events.length && events[cursor]!.at <= elapsed) {
        const event = events[cursor]!;
        const point = ballPosition(event.ball.path, event.step, rows, event.ball.bucket, payouts.length);
        emitTrail(event.ball, point, rect.width, rect.height);
        emitImpact(event.ball, point, rect.width, rect.height);
        if (event.step % 2 === 0 || ballsPerRun <= 3) playSound("plinkoPeg", soundEnabled);
        cursor += 1;
      }
      if (cursor < events.length && mountedRef.current) collisionRafRef.current = requestAnimationFrame(frame);
      else collisionRafRef.current = null;
    };
'''
new = '''    const startedAt = performance.now();
    let cursor = 0;
    const frame = (now: number) => {
      const elapsed = now - startedAt;
      let processed = 0;
      while (
        cursor < events.length &&
        events[cursor]!.at <= elapsed &&
        processed < MAX_COLLISIONS_PER_FRAME
      ) {
        const event = events[cursor]!;
        const point = ballPosition(event.ball.path, event.step, rows, event.ball.bucket, payouts.length);
        const lateBy = Math.max(0, elapsed - event.at);

        // Impacts communicate gameplay and are never removed. The trail is secondary and
        // can be skipped only when the scheduler is already outside its frame budget.
        if (lateBy <= TRAIL_LAG_BUDGET_MS) emitTrail(event.ball, point, rect.width, rect.height);
        emitImpact(event.ball, point, rect.width, rect.height);
        if (event.step % 2 === 0 || ballsPerRun <= 3) playSound("plinkoPeg", soundEnabled);
        cursor += 1;
        processed += 1;
      }
      if (cursor < events.length && mountedRef.current) collisionRafRef.current = requestAnimationFrame(frame);
      else collisionRafRef.current = null;
    };
'''

if old in text:
    text = text.replace(old, new, 1)
elif "processed < MAX_COLLISIONS_PER_FRAME" not in text:
    raise SystemExit("collision scheduler marker missing")

path.write_text(text)
