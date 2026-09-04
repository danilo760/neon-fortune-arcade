export type OlympusSymbolId =
  | "bolt"
  | "crown"
  | "chalice"
  | "coin"
  | "hammer"
  | "orb"
  | "zeus"
  | "scatter";

export type OlympusMode = "base" | "freeSpins";
export type OlympusStormLevel = 1 | 2 | 3 | 4 | 5;

export type OlympusCluster = {
  symbol: Exclude<OlympusSymbolId, "scatter">;
  indexes: number[];
  payout: number;
};

export type OlympusCascadeStep = {
  grid: OlympusSymbolId[];
  clusters: OlympusCluster[];
  winning: number[];
  basePayout: number;
  multiplier: number;
  stormLevel: OlympusStormLevel;
  stormLevelMultiplier: number;
  stormEnergyBefore: number;
  stormEnergyGain: number;
  stormEnergyAfter: number;
  stormLevelAfter: OlympusStormLevel;
  payout: number;
  nextGrid: OlympusSymbolId[];
};

export type OlympusRoundPlan = {
  mode: OlympusMode;
  initialGrid: OlympusSymbolId[];
  finalGrid: OlympusSymbolId[];
  cascades: OlympusCascadeStep[];
  payout: number;
  stormHits: number;
  scatterCount: number;
  freeSpinsAward: number;
  stormLevelStart: OlympusStormLevel;
  stormLevelEnd: OlympusStormLevel;
  stormEnergyStart: number;
  stormEnergyEnd: number;
};

export type OlympusFeatureSpinPlan = {
  spinNumber: number;
  spinsRemainingBefore: number;
  spinsRemainingAfter: number;
  retriggerAward: number;
  round: OlympusRoundPlan;
};

export type OlympusFeaturePlan = {
  initialSpins: number;
  spins: OlympusFeatureSpinPlan[];
  payout: number;
  retriggers: number;
  finalSpins: number;
  finalStormLevel: OlympusStormLevel;
  maxStormLevel: OlympusStormLevel;
  finalStormEnergy: number;
};

type SymbolDef = {
  id: Exclude<OlympusSymbolId, "scatter">;
  weight: number;
  pay: number;
};

export const OLYMPUS_COLUMNS = 6;
export const OLYMPUS_ROWS = 5;
export const OLYMPUS_SIZE = OLYMPUS_COLUMNS * OLYMPUS_ROWS;
export const OLYMPUS_MIN_CLUSTER = 5;
export const OLYMPUS_MAX_CASCADES = 8;
export const OLYMPUS_BASE_SCATTER_CHANCE = 0.014;
export const OLYMPUS_FREE_SCATTER_CHANCE = 0.01;
export const OLYMPUS_BASE_PAY_SCALE = 0.98;
export const OLYMPUS_FEATURE_BUY_INITIAL_SPINS = 8;
export const OLYMPUS_FEATURE_BUY_COST_MULTIPLIER = 9;
export const OLYMPUS_MAX_RETRIGGERS = 3;
export const OLYMPUS_FEATURE_MAX_SPINS = 60;
export const OLYMPUS_STORM_LEVEL_MULTIPLIERS = [1, 1.38, 1.82, 2.45, 3.2] as readonly number[] & Record<number, number>;
export const OLYMPUS_STORM_LEVEL_THRESHOLDS = [2, 3, 4, 5] as const;

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

function scatterChance(mode: OlympusMode) {
  return mode === "freeSpins" ? OLYMPUS_FREE_SCATTER_CHANCE : OLYMPUS_BASE_SCATTER_CHANCE;
}

function payScale(mode: OlympusMode) {
  return mode === "freeSpins" ? 1 : OLYMPUS_BASE_PAY_SCALE;
}

export function olympusFeatureBuyCost(bet: number) {
  return Math.max(0, Math.round(bet * OLYMPUS_FEATURE_BUY_COST_MULTIPLIER));
}

export function countOlympusScatters(grid: readonly OlympusSymbolId[]) {
  return grid.reduce((count, symbol) => count + (symbol === "scatter" ? 1 : 0), 0);
}

export function olympusFreeSpinsAward(mode: OlympusMode, scatterCount: number) {
  if (scatterCount < 3) return 0;
  if (mode === "freeSpins") {
    if (scatterCount === 3) return 5;
    if (scatterCount === 4) return 8;
    return 12;
  }
  if (scatterCount === 3) return 8;
  if (scatterCount === 4) return 12;
  return 18;
}

export function pickOlympusRegularSymbol(rng: () => number = Math.random): Exclude<OlympusSymbolId, "scatter"> {
  let roll = rng() * TOTAL_WEIGHT;
  for (const symbol of SYMBOLS) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol.id;
  }
  return "coin";
}

export function pickOlympusSymbol(
  rng: () => number = Math.random,
  mode: OlympusMode = "base",
): OlympusSymbolId {
  if (rng() < scatterChance(mode)) return "scatter";
  return pickOlympusRegularSymbol(rng);
}

export function makeOlympusGrid(
  rng: () => number = Math.random,
  mode: OlympusMode = "base",
): OlympusSymbolId[] {
  return Array.from({ length: OLYMPUS_SIZE }, () => pickOlympusSymbol(rng, mode));
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

    if (symbol === "scatter" || indexes.length < OLYMPUS_MIN_CLUSTER) continue;
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
  mode: OlympusMode = "base",
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
      next[index] = survivors[survivorIndex] ?? pickOlympusSymbol(rng, mode);
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

function stormEnergyGain(clusters: readonly OlympusCluster[], stormMultiplier: number) {
  const largestCluster = clusters.reduce((largest, cluster) => Math.max(largest, cluster.indexes.length), 0);
  return 1 + (largestCluster >= 8 ? 1 : 0) + (stormMultiplier > 1 ? 1 : 0);
}

export function advanceOlympusStormLevel(
  level: OlympusStormLevel,
  energy: number,
  gain: number,
): { level: OlympusStormLevel; energy: number } {
  let nextLevel = level;
  let nextEnergy = Math.max(0, energy) + Math.max(0, gain);
  while (nextLevel < 5) {
    const threshold = OLYMPUS_STORM_LEVEL_THRESHOLDS[nextLevel - 1];
    if (threshold === undefined || nextEnergy < threshold) break;
    nextEnergy -= threshold;
    nextLevel = (nextLevel + 1) as OlympusStormLevel;
  }
  return { level: nextLevel, energy: nextEnergy };
}

export type OlympusRoundOptions = {
  mode?: OlympusMode;
  stormLevel?: OlympusStormLevel;
  stormEnergy?: number;
};

export function planOlympusRound(
  bet: number,
  rng: () => number = Math.random,
  options: OlympusRoundOptions = {},
): OlympusRoundPlan {
  const mode = options.mode ?? "base";
  const initialGrid = makeOlympusGrid(rng, mode);
  let current = [...initialGrid];
  const cascades: OlympusCascadeStep[] = [];
  let payout = 0;
  let stormHits = 0;
  let stormLevel = options.stormLevel ?? 1;
  let stormEnergy = Math.max(0, options.stormEnergy ?? 0);
  const stormLevelStart = stormLevel;
  const stormEnergyStart = stormEnergy;

  for (let cascadeIndex = 0; cascadeIndex < OLYMPUS_MAX_CASCADES; cascadeIndex += 1) {
    const clusters = findOlympusClusters(current, bet);
    if (clusters.length === 0) break;

    const winning = [...new Set(clusters.flatMap((cluster) => cluster.indexes))].sort((a, b) => a - b);
    const rawBasePayout = clusters.reduce((sum, cluster) => sum + cluster.payout, 0);
    const basePayout = Math.round(rawBasePayout * payScale(mode));
    const multiplier = pickOlympusStormMultiplier(cascadeIndex, rng);
    const levelAtCascade = stormLevel;
    const levelMultiplier = mode === "freeSpins"
      ? (OLYMPUS_STORM_LEVEL_MULTIPLIERS[levelAtCascade - 1] ?? 1)
      : 1;
    const stepPayout = Math.round(basePayout * multiplier * levelMultiplier);
    const nextGrid = collapseOlympusGrid(current, winning, rng, mode);
    const energyBefore = stormEnergy;
    const energyGain = mode === "freeSpins" ? stormEnergyGain(clusters, multiplier) : 0;
    const advanced = mode === "freeSpins"
      ? advanceOlympusStormLevel(stormLevel, stormEnergy, energyGain)
      : { level: stormLevel, energy: stormEnergy };

    if (multiplier > 1) stormHits += 1;
    payout += stepPayout;
    cascades.push({
      grid: [...current],
      clusters,
      winning,
      basePayout,
      multiplier,
      stormLevel: levelAtCascade,
      stormLevelMultiplier: levelMultiplier,
      stormEnergyBefore: energyBefore,
      stormEnergyGain: energyGain,
      stormEnergyAfter: advanced.energy,
      stormLevelAfter: advanced.level,
      payout: stepPayout,
      nextGrid: [...nextGrid],
    });
    stormLevel = advanced.level;
    stormEnergy = advanced.energy;
    current = nextGrid;
  }

  const scatterCount = countOlympusScatters(initialGrid);
  return {
    mode,
    initialGrid,
    finalGrid: current,
    cascades,
    payout,
    stormHits,
    scatterCount,
    freeSpinsAward: olympusFreeSpinsAward(mode, scatterCount),
    stormLevelStart,
    stormLevelEnd: stormLevel,
    stormEnergyStart,
    stormEnergyEnd: stormEnergy,
  };
}

export function planOlympusFeature(
  bet: number,
  initialSpins = OLYMPUS_FEATURE_BUY_INITIAL_SPINS,
  rng: () => number = Math.random,
): OlympusFeaturePlan {
  let spinsLeft = Math.max(0, Math.floor(initialSpins));
  let stormLevel: OlympusStormLevel = 1;
  let stormEnergy = 0;
  let payout = 0;
  let retriggers = 0;
  let spinNumber = 0;
  let maxStormLevel: OlympusStormLevel = 1;
  const spins: OlympusFeatureSpinPlan[] = [];

  while (spinsLeft > 0 && spinNumber < OLYMPUS_FEATURE_MAX_SPINS) {
    const spinsRemainingBefore = spinsLeft;
    spinsLeft -= 1;
    spinNumber += 1;

    const round = planOlympusRound(bet, rng, {
      mode: "freeSpins",
      stormLevel,
      stormEnergy,
    });

    let retriggerAward = 0;
    if (round.freeSpinsAward > 0 && retriggers < OLYMPUS_MAX_RETRIGGERS) {
      retriggerAward = round.freeSpinsAward;
      spinsLeft += retriggerAward;
      retriggers += 1;
    }

    stormLevel = round.stormLevelEnd;
    stormEnergy = round.stormEnergyEnd;
    maxStormLevel = Math.max(maxStormLevel, stormLevel) as OlympusStormLevel;
    payout += round.payout;

    spins.push({
      spinNumber,
      spinsRemainingBefore,
      spinsRemainingAfter: spinsLeft,
      retriggerAward,
      round,
    });
  }

  return {
    initialSpins: Math.max(0, Math.floor(initialSpins)),
    spins,
    payout,
    retriggers,
    finalSpins: spins.length,
    finalStormLevel: stormLevel,
    maxStormLevel,
    finalStormEnergy: stormEnergy,
  };
}
