import type { FortuneFeatureCell } from "./goldenTigerFortuneFeature";

/** Center-out order keeps a respin readable while preventing nine cells from
 * resolving on the same frame. It is presentation-only; outcomes are already
 * decided by the Fortune engine before this order is used. */
export const GOLDEN_TIGER_FEATURE_STOP_ORDER = [4, 0, 8, 2, 6, 1, 7, 3, 5] as const;

export function goldenTigerFeatureRollingOrder(grid: readonly FortuneFeatureCell[]) {
  return GOLDEN_TIGER_FEATURE_STOP_ORDER.filter((index) => grid[index] === null);
}

export function goldenTigerFeatureCellStaggerMs(orderIndex: number, turbo: boolean) {
  const safe = Math.max(0, Math.min(8, Math.trunc(orderIndex)));
  // Always inside the requested 30–80 ms window, including Turbo.
  return turbo ? 30 + (safe % 4) * 4 : 42 + (safe % 5) * 7;
}
