export type CandyMode = "base" | "freeSpins";

export type CandyRegularSymbolId =
  | "lollipop"
  | "star"
  | "jelly"
  | "candy"
  | "cupcake"
  | "sprinkle"
  | "heart"
  | "diamond";

export type CandySymbolId = CandyRegularSymbolId | "partyCandy";

export type CandyCluster = {
  symbol: CandyRegularSymbolId;
  indexes: number[];
  payout: number;
};

export type CandyBombEvent = {
  index: number;
  multiplier: number;
  sourceClusterSize: number;
  energy: number;
};

export type CandyCascadeStep = {
  grid: CandySymbolId[];
  clusters: CandyCluster[];
  winning: number[];
  basePayout: number;
  bomb: CandyBombEvent | null;
  sugarMultiplier: number;
  sugarEnergyBefore: number;
  sugarEnergyAfter: number;
  sugarLevelBefore: number;
  sugarLevelAfter: number;
  featureMultiplier: number;
  payout: number;
  nextGrid: CandySymbolId[];
};

export type CandyRoundPlan = {
  mode: CandyMode;
  initialGrid: CandySymbolId[];
  finalGrid: CandySymbolId[];
  cascades: CandyCascadeStep[];
  payout: number;
  bombs: number;
  scatterCount: number;
  scatterAward: number;
  finalSugarEnergy: number;
  finalSugarLevel: number;
};

export type CandyFeatureSpin = {
  spinNumber: number;
  round: CandyRoundPlan;
  retriggerAward: number;
  spinsRemainingAfter: number;
};

export type CandyFeaturePlan = {
  initialSpins: number;
  finalSpins: number;
  payout: number;
  retriggers: number;
  spins: CandyFeatureSpin[];
  finalSugarLevel: number;
  finalSugarEnergy: number;
};

type SymbolDef = {
  id: CandyRegularSymbolId;
  weight: number;
  pay: number;
};

export const CANDY_COLUMNS = 6;
export const CANDY_ROWS = 5;
export const CANDY_SIZE = CANDY_COLUMNS * CANDY_ROWS;
export const CANDY_MIN_CLUSTER = 5;
export const CANDY_MAX_CASCADES = 8;
export const CANDY_MAX_RETRIGGERS = 2;
export const CANDY_FEATURE_MAX_SPINS = 40;
export const CANDY_FEATURE_BUY_INITIAL_SPINS = 10;

// Calibrated independently for Candy. Scatter is only generated on the initial
// grid of each paid/free spin; cascade refills remain regular symbols so a
// presentation cascade cannot silently create a trigger after the result plan.
export const CANDY_SCATTER_CHANCE: Readonly<Record<CandyMode, number>> = {
  base: 0.0165,
  freeSpins: 0.008,
};

// Party Candy reduces regular-cluster density. These scales are intentionally
// mode-specific and are validated by Monte Carlo before release.
export const CANDY_PAY_SCALE: Readonly<Record<CandyMode, number>> = {
  base: 0.94,
  freeSpins: 0.64,
};

export const CANDY_SUGAR_LEVEL_THRESHOLDS = [0, 1, 3, 6, 10] as const;
export const CANDY_SUGAR_LEVEL_MULTIPLIERS = [1, 1.18, 1.38, 1.7, 2.1] as const;

const SYMBOLS: readonly SymbolDef[] = [
  { id: "diamond", weight: 5, pay: 12.6 },
  { id: "heart", weight: 7, pay: 9.16 },
  { id: "sprinkle", weight: 9, pay: 7.16 },
  { id: "cupcake", weight: 11, pay: 5.73 },
  { id: "lollipop", weight: 13, pay: 4.7 },
  { id: "star", weight: 15, pay: 3.78 },
  { id: "jelly", weight: 17, pay: 2.98 },
  { id: "candy", weight: 19, pay: 2.41 },
];

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
const SYMBOL_BY_ID = new Map<CandyRegularSymbolId, SymbolDef>(
  SYMBOLS.map((symbol) => [symbol.id, symbol]),
);

export function pickCandyRegularSymbol(rng: () => number = Math.random): CandyRegularSymbolId {
  let roll = rng() * TOTAL_WEIGHT;
  for (const symbol of SYMBOLS) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol.id;
  }
  return "candy";
}

export function pickCandySymbol(
  mode: CandyMode = "base",
  rng: () => number = Math.random,
): CandySymbolId {
  if (rng() < CANDY_SCATTER_CHANCE[mode]) return "partyCandy";
  return pickCandyRegularSymbol(rng);
}

export function makeCandyGrid(
  rng: () => number = Math.random,
  mode: CandyMode = "base",
): CandySymbolId[] {
  return Array.from({ length: CANDY_SIZE }, () => pickCandySymbol(mode, rng));
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

export function countCandyScatters(grid: readonly CandySymbolId[]) {
  return grid.reduce((count, symbol) => count + (symbol === "partyCandy" ? 1 : 0), 0);
}

export function candyScatterAward(count: number, mode: CandyMode) {
  if (count < 3) return 0;
  if (mode === "base") return count >= 5 ? 18 : count === 4 ? 14 : 10;
  return count >= 5 ? 10 : count === 4 ? 8 : 5;
}

export function findCandyClusters(
  grid: readonly CandySymbolId[],
  bet: number,
  mode: CandyMode = "base",
): CandyCluster[] {
  if (grid.length !== CANDY_SIZE || !Number.isFinite(bet) || bet <= 0) return [];
  const visited = new Set<number>();
  const clusters: CandyCluster[] = [];

  for (let start = 0; start < grid.length; start += 1) {
    if (visited.has(start)) continue;
    const symbol = grid[start];
    if (!symbol) continue;
    visited.add(start);
    if (symbol === "partyCandy") continue;

    const queue = [start];
    const indexes: number[] = [];
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
      payout: Math.max(0, Math.round(bet * def.pay * boost * CANDY_PAY_SCALE[mode])),
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
      next[index] = survivors[cursor] ?? pickCandyRegularSymbol(rng);
      cursor += 1;
    }
  }

  return next;
}

function chooseBombIndex(cluster: CandyCluster) {
  const center = cluster.indexes.reduce((sum, index) => sum + index, 0) / cluster.indexes.length;
  return cluster.indexes.reduce(
    (best, index) => (Math.abs(index - center) < Math.abs(best - center) ? index : best),
    cluster.indexes[0] ?? 0,
  );
}

export function candyBombEnergy(multiplier: number) {
  if (multiplier >= 10) return 3;
  if (multiplier >= 5) return 2;
  return 1;
}

export function candySugarLevel(energy: number) {
  const safeEnergy = Math.max(0, Math.floor(energy));
  let level = 1;
  for (let index = 0; index < CANDY_SUGAR_LEVEL_THRESHOLDS.length; index += 1) {
    const threshold = CANDY_SUGAR_LEVEL_THRESHOLDS[index];
    if (threshold !== undefined && safeEnergy >= threshold) level = index + 1;
  }
  return Math.min(5, level);
}

export function candySugarMultiplierForLevel(level: number) {
  const index = Math.max(0, Math.min(4, Math.floor(level) - 1));
  return CANDY_SUGAR_LEVEL_MULTIPLIERS[index] ?? 1;
}

export function candyBombForCascade(
  clusters: readonly CandyCluster[],
  cascadeIndex: number,
  rng: () => number = Math.random,
  mode: CandyMode = "base",
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

  if (mode === "freeSpins" && size >= CANDY_MIN_CLUSTER) {
    chance = Math.max(chance, Math.min(0.44 + cascadeIndex * 0.06, 0.72));
    if (size < 10) values = [2, 3];
  }

  if (chance <= 0 || rng() >= chance) return null;
  const multiplier = values[Math.min(values.length - 1, Math.floor(rng() * values.length))] ?? 2;
  return {
    index: chooseBombIndex(source),
    multiplier,
    sourceClusterSize: size,
    energy: candyBombEnergy(multiplier),
  };
}

export function planCandyRound(
  bet: number,
  rng: () => number = Math.random,
  mode: CandyMode = "base",
  startingSugarEnergy = 0,
): CandyRoundPlan {
  const safeBet = Math.max(0, Math.round(bet));
  const initialGrid = makeCandyGrid(rng, mode);
  const scatterCount = countCandyScatters(initialGrid);
  const scatterAward = candyScatterAward(scatterCount, mode);
  let current = [...initialGrid];
  let sugarMultiplier = 1;
  let sugarEnergy = Math.max(0, Math.floor(startingSugarEnergy));
  let payout = 0;
  let bombs = 0;
  const cascades: CandyCascadeStep[] = [];

  for (let cascadeIndex = 0; cascadeIndex < CANDY_MAX_CASCADES; cascadeIndex += 1) {
    const clusters = findCandyClusters(current, safeBet, mode);
    if (clusters.length === 0) break;

    const winning = [...new Set(clusters.flatMap((cluster) => cluster.indexes))].sort((a, b) => a - b);
    const basePayout = clusters.reduce((sum, cluster) => sum + cluster.payout, 0);
    const sugarEnergyBefore = sugarEnergy;
    const sugarLevelBefore = candySugarLevel(sugarEnergyBefore);
    const bomb = candyBombForCascade(clusters, cascadeIndex, rng, mode);

    if (bomb) {
      sugarMultiplier += bomb.multiplier;
      bombs += 1;
      if (mode === "freeSpins") sugarEnergy += bomb.energy;
    }

    const sugarLevelAfter = candySugarLevel(sugarEnergy);
    const featureMultiplier = mode === "freeSpins" ? candySugarMultiplierForLevel(sugarLevelAfter) : 1;
    // Rule: Sugar energy from a bomb applies immediately to the cascade that
    // produced it. Presentation therefore shows Bomb -> Meter/Level -> payout.
    const stepPayout = Math.max(0, Math.round(basePayout * sugarMultiplier * featureMultiplier));
    const nextGrid = collapseCandyGrid(current, winning, rng);

    payout += stepPayout;
    cascades.push({
      grid: [...current],
      clusters,
      winning,
      basePayout,
      bomb,
      sugarMultiplier,
      sugarEnergyBefore,
      sugarEnergyAfter: sugarEnergy,
      sugarLevelBefore,
      sugarLevelAfter,
      featureMultiplier,
      payout: stepPayout,
      nextGrid: [...nextGrid],
    });
    current = nextGrid;
  }

  return {
    mode,
    initialGrid,
    finalGrid: current,
    cascades,
    payout,
    bombs,
    scatterCount,
    scatterAward,
    finalSugarEnergy: sugarEnergy,
    finalSugarLevel: candySugarLevel(sugarEnergy),
  };
}

export function planCandyFeature(
  bet: number,
  initialSpins = CANDY_FEATURE_BUY_INITIAL_SPINS,
  rng: () => number = Math.random,
): CandyFeaturePlan {
  const safeInitialSpins = Math.max(1, Math.min(CANDY_FEATURE_MAX_SPINS, Math.floor(initialSpins)));
  let scheduledSpins = safeInitialSpins;
  let retriggers = 0;
  let sugarEnergy = 0;
  let payout = 0;
  const spins: CandyFeatureSpin[] = [];

  for (let index = 0; index < scheduledSpins && index < CANDY_FEATURE_MAX_SPINS; index += 1) {
    const round = planCandyRound(bet, rng, "freeSpins", sugarEnergy);
    sugarEnergy = round.finalSugarEnergy;
    payout += round.payout;

    let retriggerAward = 0;
    if (round.scatterAward > 0 && retriggers < CANDY_MAX_RETRIGGERS) {
      retriggerAward = Math.min(round.scatterAward, CANDY_FEATURE_MAX_SPINS - scheduledSpins);
      if (retriggerAward > 0) {
        retriggers += 1;
        scheduledSpins += retriggerAward;
      }
    }

    spins.push({
      spinNumber: index + 1,
      round,
      retriggerAward,
      spinsRemainingAfter: Math.max(0, scheduledSpins - (index + 1)),
    });
  }

  return {
    initialSpins: safeInitialSpins,
    finalSpins: spins.length,
    payout: Math.max(0, payout),
    retriggers,
    spins,
    finalSugarLevel: candySugarLevel(sugarEnergy),
    finalSugarEnergy: sugarEnergy,
  };
}
