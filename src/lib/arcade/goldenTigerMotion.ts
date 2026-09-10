export const GOLDEN_TIGER_REEL_COUNT = 3;

export function goldenTigerSpinLaunchMs(turbo: boolean) {
  return turbo ? 92 : 400;
}

export function goldenTigerReelBrakeMs(column: number, turbo: boolean) {
  const safeColumn = Math.max(0, Math.min(GOLDEN_TIGER_REEL_COUNT - 1, Math.trunc(column)));
  return turbo ? 78 + safeColumn * 9 : 300 + safeColumn * 42;
}

export function goldenTigerReelLandPauseMs(column: number, turbo: boolean) {
  const safeColumn = Math.max(0, Math.min(GOLDEN_TIGER_REEL_COUNT - 1, Math.trunc(column)));
  return turbo ? 20 + safeColumn * 4 : 86 + safeColumn * 14;
}

export function goldenTigerAnticipationMs(turbo: boolean) {
  return turbo ? 44 : 280;
}

/** A slightly longer upward tension sells weight before the normal strip launches. */
export function goldenTigerReelTensionMs(turbo: boolean) {
  return turbo ? 28 : 64;
}

export function goldenTigerReelTensionPx(column: number) {
  const safe = Math.max(0, Math.min(2, Math.trunc(column)));
  return 2.5 + safe * .45;
}

/** Studio-like stop: 4 / 6 / 8px overshoot, then a short rebound. */
export function goldenTigerReelOvershootPx(column: number) {
  const safe = Math.max(0, Math.min(2, Math.trunc(column)));
  return 4 + safe * 2;
}

export function goldenTigerReelReboundMs(column: number, turbo: boolean) {
  const safe = Math.max(0, Math.min(2, Math.trunc(column)));
  return turbo ? 60 + safe * 4 : 68 + safe * 8;
}

/**
 * Motion blur is intentionally restrained. The reel strip itself supplies the
 * speed cue; keeping the cap below one pixel preserves symbol identity during
 * cruise instead of washing the reel into a flat gold/brown block.
 */
export function goldenTigerReelBlurPx(velocityPxPerMs: number) {
  const velocity = Math.max(0, Number.isFinite(velocityPxPerMs) ? velocityPxPerMs : 0);
  return Math.min(0.82, velocity * 0.34);
}

/** A smooth ease-out keeps the strip moving quickly at the beginning of the
 * brake and gives the final symbols enough time to become readable before the
 * physical landing squash handled by CSS. */
export function goldenTigerBrakeEase(progress: number) {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return 1 - (1 - t) ** 4;
}

/** Small critically-damped-looking curve for the overshoot return. */
export function goldenTigerReboundEase(progress: number) {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return 1 - Math.cos((t * Math.PI) / 2);
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
