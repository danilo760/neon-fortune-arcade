export const GOLDEN_TIGER_REEL_COUNT = 3;

/**
 * Readable commercial pacing. Normal mode deliberately gives each reel enough
 * time to accelerate, brake and land as a separate beat. Turbo is compressed,
 * but still preserves all three stops instead of visually skipping them.
 *
 * Keep the tested total duration stable, but spend more of that budget on the
 * visible brake itself instead of dead launch/landing waits.
 */
export function goldenTigerSpinLaunchMs(turbo: boolean) {
  return turbo ? 250 : 600;
}

export function goldenTigerReelBrakeMs(column: number, turbo: boolean) {
  const safeColumn = Math.max(0, Math.min(GOLDEN_TIGER_REEL_COUNT - 1, Math.trunc(column)));
  return turbo ? 250 + safeColumn * 30 : 1_000 + safeColumn * 80;
}

export function goldenTigerReelLandPauseMs(column: number, turbo: boolean) {
  const safeColumn = Math.max(0, Math.min(GOLDEN_TIGER_REEL_COUNT - 1, Math.trunc(column)));
  return turbo ? 70 + safeColumn * 10 : 180 + safeColumn * 20;
}

export function goldenTigerAnticipationMs(turbo: boolean) {
  return turbo ? 230 : 820;
}

/** A small upward preload sells inertia before the strip starts moving. */
export function goldenTigerReelTensionMs(turbo: boolean) {
  return turbo ? 90 : 240;
}

export function goldenTigerReelTensionPx(column: number) {
  const safe = Math.max(0, Math.min(2, Math.trunc(column)));
  return 3 + safe * .45;
}

/** Slightly larger late-reel overshoot gives columns 2/3 more perceived mass. */
export function goldenTigerReelOvershootPx(column: number) {
  const safe = Math.max(0, Math.min(2, Math.trunc(column)));
  return 6 + safe * 1.5;
}

export function goldenTigerReelReboundMs(column: number, turbo: boolean) {
  const safe = Math.max(0, Math.min(2, Math.trunc(column)));
  return turbo ? 125 + safe * 9 : 260 + safe * 18;
}

/**
 * Kept for deterministic tests and optional non-compositor consumers. The live
 * reel track uses only a restrained velocity blur so individual symbols remain
 * readable while falling.
 */
export function goldenTigerReelBlurPx(velocityPxPerMs: number) {
  const velocity = Math.max(0, Number.isFinite(velocityPxPerMs) ? velocityPxPerMs : 0);
  return Math.min(0.48, velocity * 0.19);
}

/** A deliberate ease-out exposes the final symbols before the physical snap. */
export function goldenTigerBrakeEase(progress: number) {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return 1 - (1 - t) ** 2.45;
}

/** Small critically-damped-looking curve for the overshoot return. */
export function goldenTigerReboundEase(progress: number) {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return 1 - Math.cos((t * Math.PI) / 2);
}

export function goldenTigerRevealPauseMs(turbo: boolean, hasWin: boolean) {
  if (turbo) return hasWin ? 300 : 220;
  return hasWin ? 900 : 520;
}

export function goldenTigerAutoGapMs(turbo: boolean) {
  return turbo ? 280 : 720;
}

export function goldenTigerNominalSpinMs(turbo: boolean, anticipation = false) {
  let total = goldenTigerSpinLaunchMs(turbo);
  for (let column = 0; column < GOLDEN_TIGER_REEL_COUNT; column += 1) {
    total += goldenTigerReelBrakeMs(column, turbo);
    total += goldenTigerReelLandPauseMs(column, turbo);
  }
  if (anticipation) total += goldenTigerAnticipationMs(turbo);
  return total;
}
