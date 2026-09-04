export type OlympusSymbolId = "bolt" | "crown" | "chalice" | "coin" | "hammer" | "orb" | "zeus";

export type OlympusCluster = {
  symbol: OlympusSymbolId;
  indexes: number[];
  payout: number;
};

export type OlympusCascadeStep = {
  grid: OlympusSymbolId[];
  clusters: OlympusCluster[];
  winning: number[];
  basePayout: number;
  multiplier: number;
  payout: number;
  nextGrid: OlympusSymbolId[];
};

export type OlympusRoundPlan = {
  initialGrid: OlympusSymbolId[];
  finalGrid: OlympusSymbolId[];
  cascades: OlympusCascadeStep[];
  payout: number;
  stormHits: number;
};

type SymbolDef = {
  id: OlympusSymbolId;
  weight: number;
  pay: number;
};

export const OLYMPUS_COLUMNS = 6;
export const OLYMPUS_ROWS = 5;
export const OLYMPUS_SIZE = OLYMPUS_COLUMNS * OLYMPUS_ROWS;
export const OLYMPUS_MIN_CLUSTER = 5;
export const OLYMPUS_MAX_CASCADES = 8;

const SYMBOLS: readonly SymbolDef[] = [
  { id: "zeus", weight: 5, pay: 6.64 },
  { id: "bolt", weight: 8, pay: 5.09 },
  { id: "crown", weight: 10, pay: 3.98 },
  { id: "chalice", weight: 12, pay: 3.21 },
  { id: "hammer", weight: 14, pay: 2.65 },
  { id: "orb", weight: 16, pay: 2.16 },
  { id: "coin", weight: 18, pay: 1.71 },
];

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
const SYMBOL_BY_ID = new Map(SYMBOLS.map((symbol) => [symbol.id, symbol]));
const STORM_MULTIPLIERS = [2, 3, 5] as const;
const STORM_WEIGHTS = [0.65, 0.27, 0.08] as const;

export function pickOlympusSymbol(rng: () => number = Math.random): OlympusSymbolId {
  let roll = rng() * TOTAL_WEIGHT;
  for (const symbol of SYMBOLS) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol.id;
  }
  return "coin";
}

export function makeOlympusGrid(rng: () => number = Math.random): OlympusSymbolId[] {
  return Array.from({ length: OLYMPUS_SIZE }, () => pickOlympusSymbol(rng));
}

function neighbors(index: number) {
  const row = Math.floor(index / OLYMPUS_COLUMNS);
  const column = index % OLYMPUS_COLUMNS;
  const result: number[] = [];
  if (row > 0) result.push(index - OLYMPUS_COLUMNS);
  if (row < OLYMPUS_ROWS - 1) result.push(index + OLYMPUS_COLUMNS);
  if (column > 0) result.push(index - 1);
  if (column < OLYMPUS_COLUMNS - 1) result.push(index + 1);
  return result;
}

export function findOlympusClusters(grid: readonly OlympusSymbolId[], bet: number): OlympusCluster[] {
  if (grid.length !== OLYMPUS_SIZE) return [];
  const visited = new Set<number>();
  const clusters: OlympusCluster[] = [];

  for (let start = 0; start < grid.length; start += 1) {
    if (visited.has(start)) continue;
    const symbol = grid[start];
    if (!symbol) continue;

    const stack = [start];
    const indexes: number[] = [];
    visited.add(start);

    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined) break;
      indexes.push(current);
      for (const next of neighbors(current)) {
        if (visited.has(next) || grid[next] !== symbol) continue;
        visited.add(next);
        stack.push(next);
      }
    }

    if (indexes.length < OLYMPUS_MIN_CLUSTER) continue;
    const def = SYMBOL_BY_ID.get(symbol);
    if (!def) continue;
    const sizeBoost = 1 + Math.max(0, indexes.length - OLYMPUS_MIN_CLUSTER) * 0.22;
    clusters.push({
      symbol,
      indexes: indexes.sort((a, b) => a - b),
      payout: Math.round(bet * def.pay * sizeBoost),
    });
  }

  return clusters;
}

export function collapseOlympusGrid(
  grid: readonly OlympusSymbolId[],
  removedIndexes: readonly number[],
  rng: () => number = Math.random,
): OlympusSymbolId[] {
  const removed = new Set(removedIndexes);
  const next = Array<OlympusSymbolId>(OLYMPUS_SIZE);

  for (let column = 0; column < OLYMPUS_COLUMNS; column += 1) {
    const survivors: OlympusSymbolId[] = [];
    for (let row = OLYMPUS_ROWS - 1; row >= 0; row -= 1) {
      const index = row * OLYMPUS_COLUMNS + column;
      const symbol = grid[index];
      if (!removed.has(index) && symbol) survivors.push(symbol);
    }

    let survivorIndex = 0;
    for (let row = OLYMPUS_ROWS - 1; row >= 0; row -= 1) {
      const index = row * OLYMPUS_COLUMNS + column;
      next[index] = survivors[survivorIndex] ?? pickOlympusSymbol(rng);
      survivorIndex += 1;
    }
  }

  return next;
}

export function pickOlympusStormMultiplier(
  cascadeIndex: number,
  rng: () => number = Math.random,
): number {
  const chance = Math.min(0.12 + cascadeIndex * 0.06, 0.36);
  if (rng() >= chance) return 1;

  let roll = rng();
  for (let index = 0; index < STORM_MULTIPLIERS.length; index += 1) {
    roll -= STORM_WEIGHTS[index] ?? 0;
    if (roll <= 0) return STORM_MULTIPLIERS[index] ?? 2;
  }
  return 2;
}

export function planOlympusRound(
  bet: number,
  rng: () => number = Math.random,
): OlympusRoundPlan {
  const initialGrid = makeOlympusGrid(rng);
  let current = [...initialGrid];
  const cascades: OlympusCascadeStep[] = [];
  let payout = 0;
  let stormHits = 0;

  for (let cascadeIndex = 0; cascadeIndex < OLYMPUS_MAX_CASCADES; cascadeIndex += 1) {
    const clusters = findOlympusClusters(current, bet);
    if (clusters.length === 0) break;

    const winning = [...new Set(clusters.flatMap((cluster) => cluster.indexes))].sort((a, b) => a - b);
    const basePayout = clusters.reduce((sum, cluster) => sum + cluster.payout, 0);
    const multiplier = pickOlympusStormMultiplier(cascadeIndex, rng);
    const stepPayout = Math.round(basePayout * multiplier);
    const nextGrid = collapseOlympusGrid(current, winning, rng);

    if (multiplier > 1) stormHits += 1;
    payout += stepPayout;
    cascades.push({
      grid: [...current],
      clusters,
      winning,
      basePayout,
      multiplier,
      payout: stepPayout,
      nextGrid: [...nextGrid],
    });
    current = nextGrid;
  }

  return {
    initialGrid,
    finalGrid: current,
    cascades,
    payout,
    stormHits,
  };
}
