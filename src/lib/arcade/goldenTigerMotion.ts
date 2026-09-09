export const GOLDEN_TIGER_REEL_COUNT = 3;

export function goldenTigerSpinLaunchMs(turbo: boolean) {
  return turbo ? 92 : 320;
}

export function goldenTigerReelBrakeMs(column: number, turbo: boolean) {
  const safeColumn = Math.max(0, Math.min(GOLDEN_TIGER_REEL_COUNT - 1, Math.trunc(column)));
  return turbo ? 72 + safeColumn * 8 : 220 + safeColumn * 30;
}

export function goldenTigerReelLandPauseMs(column: number, turbo: boolean) {
  const safeColumn = Math.max(0, Math.min(GOLDEN_TIGER_REEL_COUNT - 1, Math.trunc(column)));
  return turbo ? 18 + safeColumn * 4 : 58 + safeColumn * 8;
}

export function goldenTigerAnticipationMs(turbo: boolean) {
  return turbo ? 44 : 220;
}

/**
 * A smooth ease-out keeps the strip moving quickly at the beginning of the
 * brake and gives the final symbols enough time to become readable before the
 * physical landing squash handled by CSS. It stays monotonic so the reel never
 * reverses or exposes an outcome that was not already decided by the engine.
 */
export function goldenTigerBrakeEase(progress: number) {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return 1 - (1 - t) ** 4;
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
