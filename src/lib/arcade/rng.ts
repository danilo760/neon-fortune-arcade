/**
 * Pseudo-random helpers for local, fictional-only play.
 * Deterministic seeded generator so results are testable.
 */

export type Rng = () => number;

/** mulberry32 — small, fast, good enough for toy games. */
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(): Rng {
  return Math.random;
}

export function randomInt(rng: Rng, minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick() requires a non-empty array");
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
}

export interface Weighted<T> {
  value: T;
  weight: number;
}

export function pickWeighted<T>(rng: Rng, items: readonly Weighted<T>[]): T {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= 0) throw new Error("pickWeighted() requires positive total weight");
  let roll = rng() * total;
  for (const item of items) {
    roll -= Math.max(0, item.weight);
    if (roll <= 0) return item.value;
  }
  return items[items.length - 1]!.value;
}

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Picks `count` distinct indexes from [0, size). */
export function sampleIndexes(rng: Rng, size: number, count: number): number[] {
  const pool = shuffle(
    rng,
    Array.from({ length: size }, (_, i) => i),
  );
  return pool.slice(0, Math.max(0, Math.min(size, count)));
}
