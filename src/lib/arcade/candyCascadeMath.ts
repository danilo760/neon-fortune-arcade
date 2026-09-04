export type CandySymbolId =
  | "lollipop"
  | "star"
  | "jelly"
  | "candy"
  | "cupcake"
  | "sprinkle"
  | "heart"
  | "diamond";

export type CandyCluster = {
  symbol: CandySymbolId;
  indexes: number[];
  payout: number;
};

export type CandyBombEvent = {
  index: number;
  multiplier: number;
  sourceClusterSize: number;
};

export type CandyCascadeStep = {
  grid: CandySymbolId[];
  clusters: CandyCluster[];
  winning: number[];
  basePayout: number;
  bomb: CandyBombEvent | null;
  sugarMultiplier: number;
  payout: number;
  nextGrid: CandySymbolId[];
};

export type CandyRoundPlan = {
  initialGrid: CandySymbolId[];
  finalGrid: CandySymbolId[];
  cascades: CandyCascadeStep[];
  payout: number;
  bombs: number;
};

type SymbolDef = {
  id: CandySymbolId;
  weight: number;
  pay: number;
};

export const CANDY_COLUMNS = 6;
export const CANDY_ROWS = 5;
export const CANDY_SIZE = CANDY_COLUMNS * CANDY_ROWS;
export const CANDY_MIN_CLUSTER = 5;
export const CANDY_MAX_CASCADES = 8;

const SYMBOLS: readonly SymbolDef[] = [
  { id: "diamond", weight: 5, pay: 2.2 },
  { id: "heart", weight: 7, pay: 1.6 },
  { id: "sprinkle", weight: 9, pay: 1.25 },
  { id: "cupcake", weight: 11, pay: 1.0 },
  { id: "lollipop", weight: 13, pay: 0.82 },
  { id: "star", weight: 15, pay: 0.66 },
  { id: "jelly", weight: 17, pay: 0.52 },
  { id: "candy", weight: 19, pay: 0.42 },
];

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
const SYMBOL_BY_ID = new Map(SYMBOLS.map((symbol) => [symbol.id, symbol]));

export function pickCandySymbol(rng: () => number = Math.random): CandySymbolId {
  let roll = rng() * TOTAL_WEIGHT;
  for (const symbol of SYMBOLS) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol.id;
  }
  return "candy";
}

export function makeCandyGrid(rng: () => number = Math.random): CandySymbolId[] {
  return Array.from({ length: CANDY_SIZE }, () => pickCandySymbol(rng));
}

function neighbors(index: number) {
  const row = Math.floor(index / CANDY_COLUMNS);
  const column = index % CANDY_COLUMNS;
  const result: number[] = [];
  if (row > 0) result.push(index - CANDY_COLUMNS);
  if (row < CANDY_ROWS - 1) result.push(index + CANDY_COLUMNS);
  if (column > 0) result.push(index - 1);
  if (column < CANDY_COLUMNS - 1) result.push(index + 1);
  return result;
}

export function findCandyClusters(grid: readonly CandySymbolId[], bet: number): CandyCluster[] {
  if (grid.length !== CANDY_SIZE) return [];
  const visited = new Set<number>();
  const clusters: CandyCluster[] = [];

  for (let start = 0; start < grid.length; start += 1) {
    if (visited.has(start)) continue;
    const symbol = grid[start];
    if (!symbol) continue;

    const queue = [start];
    const indexes: number[] = [];
    visited.add(start);

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      indexes.push(current);
      for (const next of neighbors(current)) {
        if (visited.has(next) || grid[next] !== symbol) continue;
        visited.add(next);
        queue.push(next);
      }
    }

    if (indexes.length < CANDY_MIN_CLUSTER) continue;
    const def = SYMBOL_BY_ID.get(symbol);
    if (!def) continue;
    const count = indexes.length;
    const boost = count >= 15 ? 7 : count >= 12 ? 5 : count >= 9 ? 3 : count >= 7 ? 1.8 : 1;
    clusters.push({
      symbol,
      indexes: indexes.sort((a, b) => a - b),
      payout: Math.round(bet * def.pay * boost),
    });
  }

  return clusters;
}

export function collapseCandyGrid(
  grid: readonly CandySymbolId[],
  removedIndexes: readonly number[],
  rng: () => number = Math.random,
): CandySymbolId[] {
  const removed = new Set(removedIndexes);
  const next = Array<CandySymbolId>(CANDY_SIZE);

  for (let column = 0; column < CANDY_COLUMNS; column += 1) {
    const survivors: CandySymbolId[] = [];
    for (let row = CANDY_ROWS - 1; row >= 0; row -= 1) {
      const index = row * CANDY_COLUMNS + column;
      const symbol = grid[index];
      if (!removed.has(index) && symbol) survivors.push(symbol);
    }

    let cursor = 0;
    for (let row = CANDY_ROWS - 1; row >= 0; row -= 1) {
      const index = row * CANDY_COLUMNS + column;
      next[index] = survivors[cursor] ?? pickCandySymbol(rng);
      cursor += 1;
    }
  }

  return next;
}

function chooseBombIndex(cluster: CandyCluster) {
  const center = cluster.indexes.reduce((sum, index) => sum + index, 0) / cluster.indexes.length;
  return cluster.indexes.reduce((best, index) =>
    Math.abs(index - center) < Math.abs(best - center) ? index : best,
  cluster.indexes[0] ?? 0);
}

export function candyBombForCascade(
  clusters: readonly CandyCluster[],
  cascadeIndex: number,
  rng: () => number = Math.random,
): CandyBombEvent | null {
  const source = [...clusters].sort((a, b) => b.indexes.length - a.indexes.length)[0];
  if (!source) return null;

  const size = source.indexes.length;
  let chance = 0;
  let values: readonly number[] = [2];

  if (size >= 12) {
    chance = 1;
    values = [5, 10];
  } else if (size >= 10) {
    chance = 0.72;
    values = [3, 5];
  } else if (size >= 8) {
    chance = 0.42;
    values = [2, 3];
  } else if (cascadeIndex >= 2) {
    chance = Math.min(0.2 + (cascadeIndex - 2) * 0.1, 0.5);
    values = [2, 3];
  }

  if (chance <= 0 || rng() >= chance) return null;
  const multiplier = values[Math.min(values.length - 1, Math.floor(rng() * values.length))] ?? 2;
  return {
    index: chooseBombIndex(source),
    multiplier,
    sourceClusterSize: size,
  };
}

export function planCandyRound(
  bet: number,
  rng: () => number = Math.random,
): CandyRoundPlan {
  const initialGrid = makeCandyGrid(rng);
  let current = [...initialGrid];
  let sugarMultiplier = 1;
  let payout = 0;
  let bombs = 0;
  const cascades: CandyCascadeStep[] = [];

  for (let cascadeIndex = 0; cascadeIndex < CANDY_MAX_CASCADES; cascadeIndex += 1) {
    const clusters = findCandyClusters(current, bet);
    if (clusters.length === 0) break;

    const winning = [...new Set(clusters.flatMap((cluster) => cluster.indexes))].sort((a, b) => a - b);
    const basePayout = clusters.reduce((sum, cluster) => sum + cluster.payout, 0);
    const bomb = candyBombForCascade(clusters, cascadeIndex, rng);
    if (bomb) {
      sugarMultiplier += bomb.multiplier;
      bombs += 1;
    }
    const stepPayout = Math.round(basePayout * sugarMultiplier);
    const nextGrid = collapseCandyGrid(current, winning, rng);

    payout += stepPayout;
    cascades.push({
      grid: [...current],
      clusters,
      winning,
      basePayout,
      bomb,
      sugarMultiplier,
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
    bombs,
  };
}
