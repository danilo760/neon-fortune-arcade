export const GOLDEN_TIGER_REEL_COUNT = 3;

export function goldenTigerSpinLaunchMs(turbo: boolean) {
  return turbo ? 110 : 300;
}

export function goldenTigerReelBrakeMs(column: number, turbo: boolean) {
  const safeColumn = Math.max(0, Math.min(GOLDEN_TIGER_REEL_COUNT - 1, Math.trunc(column)));
  return turbo ? 78 + safeColumn * 9 : 190 + safeColumn * 25;
}

export function goldenTigerReelLandPauseMs(column: number, turbo: boolean) {
  const safeColumn = Math.max(0, Math.min(GOLDEN_TIGER_REEL_COUNT - 1, Math.trunc(column)));
  return turbo ? 24 + safeColumn * 4 : 58 + safeColumn * 8;
}

export function goldenTigerAnticipationMs(turbo: boolean) {
  return turbo ? 34 : 120;
}

/** Smooth high-speed motion into a deterministic reel stop. */
export function goldenTigerBrakeEase(progress: number) {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return 1 - (1 - t) ** 3;
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
