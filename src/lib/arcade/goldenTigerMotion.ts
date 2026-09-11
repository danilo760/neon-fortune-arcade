export const GOLDEN_TIGER_REEL_COUNT = 3;

/**
 * Readable commercial pacing. Normal mode deliberately gives each reel enough
 * time to accelerate, brake and land as a separate beat. Turbo is compressed,
 * but still preserves all three stops instead of visually skipping them.
 */
export function goldenTigerSpinLaunchMs(turbo: boolean) {
  return turbo ? 240 : 900;
}

export function goldenTigerReelBrakeMs(column: number, turbo: boolean) {
  const safeColumn = Math.max(0, Math.min(GOLDEN_TIGER_REEL_COUNT - 1, Math.trunc(column)));
  return turbo ? 160 + safeColumn * 20 : 570 + safeColumn * 70;
}

export function goldenTigerReelLandPauseMs(column: number, turbo: boolean) {
  const safeColumn = Math.max(0, Math.min(GOLDEN_TIGER_REEL_COUNT - 1, Math.trunc(column)));
  return turbo ? 70 + safeColumn * 8 : 210 + safeColumn * 25;
}

export function goldenTigerAnticipationMs(turbo: boolean) {
  return turbo ? 170 : 650;
}

/** A small upward preload sells inertia before the strip starts moving. */
export function goldenTigerReelTensionMs(turbo: boolean) {
  return turbo ? 55 : 150;
}

export function goldenTigerReelTensionPx(column: number) {
  const safe = Math.max(0, Math.min(2, Math.trunc(column)));
  return 2.75 + safe * .45;
}

/** Slightly larger late-reel overshoot gives columns 2/3 more perceived mass. */
export function goldenTigerReelOvershootPx(column: number) {
  const safe = Math.max(0, Math.min(2, Math.trunc(column)));
  return 5.5 + safe * 1.5;
}

export function goldenTigerReelReboundMs(column: number, turbo: boolean) {
  const safe = Math.max(0, Math.min(2, Math.trunc(column)));
  return turbo ? 90 + safe * 7 : 165 + safe * 12;
}

/**
 * Kept for deterministic tests and optional non-compositor consumers. The live
 * reel track no longer mutates CSS filter every animation frame: the static
 * reel shade/streak layers supply motion depth without forcing filtered moving
 * surfaces on mobile GPUs.
 */
export function goldenTigerReelBlurPx(velocityPxPerMs: number) {
  const velocity = Math.max(0, Number.isFinite(velocityPxPerMs) ? velocityPxPerMs : 0);
  return Math.min(0.66, velocity * 0.24);
}

/** A deliberate ease-out exposes the final symbols before the physical snap. */
export function goldenTigerBrakeEase(progress: number) {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return 1 - (1 - t) ** 3.35;
}

/** Small critically-damped-looking curve for the overshoot return. */
export function goldenTigerReboundEase(progress: number) {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return 1 - Math.cos((t * Math.PI) / 2);
}

export function goldenTigerRevealPauseMs(turbo: boolean, hasWin: boolean) {
  if (turbo) return hasWin ? 180 : 130;
  return hasWin ? 520 : 320;
}

export function goldenTigerAutoGapMs(turbo: boolean) {
  return turbo ? 190 : 520;
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
