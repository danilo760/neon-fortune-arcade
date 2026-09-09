export const GOLDEN_TIGER_REEL_COUNT = 3;

export function goldenTigerSpinLaunchMs(turbo: boolean) {
  return turbo ? 92 : 300;
}

export function goldenTigerReelBrakeMs(column: number, turbo: boolean) {
  const safeColumn = Math.max(0, Math.min(GOLDEN_TIGER_REEL_COUNT - 1, Math.trunc(column)));
  return turbo ? 78 + safeColumn * 9 : 230 + safeColumn * 34;
}

export function goldenTigerReelLandPauseMs(column: number, turbo: boolean) {
  const safeColumn = Math.max(0, Math.min(GOLDEN_TIGER_REEL_COUNT - 1, Math.trunc(column)));
  return turbo ? 20 + safeColumn * 4 : 64 + safeColumn * 10;
}

export function goldenTigerAnticipationMs(turbo: boolean) {
  return turbo ? 44 : 220;
}

/** Two-to-three visual frames of upward tension before the strip launches. */
export function goldenTigerReelTensionMs(turbo: boolean) {
  return turbo ? 28 : 46;
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

export function goldenTigerReelBlurPx(velocityPxPerMs: number) {
  const velocity = Math.max(0, Number.isFinite(velocityPxPerMs) ? velocityPxPerMs : 0);
  return Math.min(2.6, velocity * 1.15);
}

/** A smooth ease-out keeps the strip moving quickly at the beginning of the
 * brake and gives the final symbols enough time to become readable before the
 * physical landing squash handled by CSS. */
export function goldenTigerBrakeEase(progress: number) {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return 1 - (1 - t) ** 4;
}

/** Small critically-damped-looking curve for the 60–90ms overshoot return. */
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
