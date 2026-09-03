import { sampleIndexes, type Rng } from "./rng";

export const MINES_GRID_SIZE = 25;
export const MIN_MINES = 1;
export const MAX_MINES = 10;

export function createMineField(rng: Rng, mineCount: number): number[] {
  const safeCount = Math.max(MIN_MINES, Math.min(MAX_MINES, Math.floor(mineCount)));
  return sampleIndexes(rng, MINES_GRID_SIZE, safeCount).sort((a, b) => a - b);
}

/**
 * Fair-ish toy multiplier: product of (remaining / safe remaining) with a small house edge,
 * purely for local entertainment. Not a certified RTP model.
 */
export function minesMultiplier(mineCount: number, revealed: number): number {
  if (revealed <= 0) return 1;
  let multiplier = 1;
  for (let step = 0; step < revealed; step++) {
    const remaining = MINES_GRID_SIZE - step;
    const safeRemaining = remaining - mineCount;
    if (safeRemaining <= 0) break;
    multiplier *= remaining / safeRemaining;
  }
  return Math.round(multiplier * 0.97 * 100) / 100;
}

export function nextMinesMultiplier(mineCount: number, revealed: number): number {
  return minesMultiplier(mineCount, revealed + 1);
}
