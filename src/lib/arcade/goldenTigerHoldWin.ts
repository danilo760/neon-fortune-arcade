export const HOLD_WIN_GRID_SIZE = 9;
export const HOLD_WIN_INITIAL_RESPINS = 3;
export const HOLD_WIN_RESPIN_RESET = 3;
export const HOLD_WIN_FULL_GRID_BONUS = 10;

/** Per-cell chance on a paid base spin. Across 9 cells this is ~1 trigger every 67 spins. */
export const GOLD_COIN_TRIGGER_CHANCE = 1 / 600;
/** Per-unlocked-cell chance during Hold & Win. Tuned so 9/9 remains exceptionally rare. */
export const HOLD_WIN_COIN_CHANCE = 0.025;

export const GOLD_COIN_VALUE_TABLE = [
  { multiplier: 1, weight: 40 },
  { multiplier: 2, weight: 25 },
  { multiplier: 3, weight: 15 },
  { multiplier: 5, weight: 10 },
  { multiplier: 10, weight: 6 },
  { multiplier: 20, weight: 3 },
  { multiplier: 50, weight: 1 },
] as const;

/**
 * 400k seeded simulations average the feature close to 6.39x bet from one entry coin.
 * Pricing at 6.7x produces roughly 95% purchased-feature return while keeping the
 * raw Hold & Win math unchanged.
 */
export const HOLD_WIN_FEATURE_BUY_COST_MULTIPLIER = 6.7;
export const HOLD_WIN_FEATURE_BUY_TARGET_RETURN = 0.95;

export type GoldCoinValue = (typeof GOLD_COIN_VALUE_TABLE)[number]["multiplier"];

export type HoldWinCoin = {
  index: number;
  value: GoldCoinValue;
};

export type CellResult = {
  index: number;
  locked: boolean;
  value: GoldCoinValue | null;
};

export type HoldWinStep = {
  grid: CellResult[];
  addedIndices: number[];
  respinsRemaining: number;
  isFullGrid: boolean;
};

export type HoldWinResult = {
  finalGrid: CellResult[];
  totalCoins: number;
  totalValue: number;
  isFullGrid: boolean;
  payout: number;
  respinsUsed: number;
  steps: HoldWinStep[];
};

const TOTAL_COIN_VALUE_WEIGHT = GOLD_COIN_VALUE_TABLE.reduce(
  (sum, item) => sum + item.weight,
  0,
);

function unitRoll(rng: () => number) {
  const value = rng();
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(0.999999999999, value));
}

export function rollGoldCoinPresence(
  rng: () => number = Math.random,
  chance = GOLD_COIN_TRIGGER_CHANCE,
) {
  const normalizedChance = Number.isFinite(chance) ? Math.max(0, Math.min(1, chance)) : 0;
  return unitRoll(rng) < normalizedChance;
}

export function rollGoldCoinValue(rng: () => number = Math.random): GoldCoinValue {
  let roll = unitRoll(rng) * TOTAL_COIN_VALUE_WEIGHT;
  for (const item of GOLD_COIN_VALUE_TABLE) {
    roll -= item.weight;
    if (roll < 0) return item.multiplier;
  }
  return 1;
}

export function rollGoldCoin(
  rng: () => number = Math.random,
): { isCoin: false } | { isCoin: true; value: GoldCoinValue } {
  if (!rollGoldCoinPresence(rng, GOLD_COIN_TRIGGER_CHANCE)) return { isCoin: false };
  return { isCoin: true, value: rollGoldCoinValue(rng) };
}

export function rollBaseGoldCoinGrid(rng: () => number = Math.random): HoldWinCoin[] {
  const coins: HoldWinCoin[] = [];
  for (let index = 0; index < HOLD_WIN_GRID_SIZE; index += 1) {
    const result = rollGoldCoin(rng);
    if (result.isCoin) coins.push({ index, value: result.value });
  }
  return coins;
}

export function goldCoinTriggerProbability() {
  return 1 - (1 - GOLD_COIN_TRIGGER_CHANCE) ** HOLD_WIN_GRID_SIZE;
}

function emptyGrid(): CellResult[] {
  return Array.from({ length: HOLD_WIN_GRID_SIZE }, (_, index) => ({
    index,
    locked: false,
    value: null,
  }));
}

function cloneGrid(grid: readonly CellResult[]): CellResult[] {
  return grid.map((cell) => ({ ...cell }));
}

function normalizeInitialCoins(coins: readonly HoldWinCoin[]) {
  const byIndex = new Map<number, GoldCoinValue>();
  for (const coin of coins) {
    if (!Number.isInteger(coin.index) || coin.index < 0 || coin.index >= HOLD_WIN_GRID_SIZE) continue;
    if (!GOLD_COIN_VALUE_TABLE.some((item) => item.multiplier === coin.value)) continue;
    byIndex.set(coin.index, coin.value);
  }
  return [...byIndex.entries()].map(([index, value]) => ({ index, value }));
}

function seedPurchasedFeature(rng: () => number): HoldWinCoin[] {
  const index = Math.floor(unitRoll(rng) * HOLD_WIN_GRID_SIZE);
  return [{ index, value: rollGoldCoinValue(rng) }];
}

/**
 * Pre-computes the entire Hold & Win outcome before UI animation starts.
 * `initialCoins` is supplied by a triggering base spin; when omitted, the function
 * represents a direct feature purchase and seeds one entry coin deterministically.
 */
export function runHoldWinFeature(
  bet: number,
  rng: () => number = Math.random,
  initialCoins?: readonly HoldWinCoin[],
): HoldWinResult {
  const safeBet = Number.isFinite(bet) && bet > 0 ? bet : 0;
  const supplied = initialCoins ? normalizeInitialCoins(initialCoins) : [];
  const entryCoins = supplied.length > 0 ? supplied : seedPurchasedFeature(rng);
  const grid = emptyGrid();

  for (const coin of entryCoins) {
    grid[coin.index] = { index: coin.index, locked: true, value: coin.value };
  }

  let respinsRemaining = HOLD_WIN_INITIAL_RESPINS;
  let respinsUsed = 0;
  const steps: HoldWinStep[] = [];

  while (respinsRemaining > 0 && grid.some((cell) => !cell.locked)) {
    respinsUsed += 1;
    const addedIndices: number[] = [];

    for (const cell of grid) {
      if (cell.locked) continue;
      if (!rollGoldCoinPresence(rng, HOLD_WIN_COIN_CHANCE)) continue;
      cell.locked = true;
      cell.value = rollGoldCoinValue(rng);
      addedIndices.push(cell.index);
    }

    if (addedIndices.length > 0) respinsRemaining = HOLD_WIN_RESPIN_RESET;
    else respinsRemaining -= 1;

    const isFullGrid = grid.every((cell) => cell.locked);
    steps.push({
      grid: cloneGrid(grid),
      addedIndices,
      respinsRemaining,
      isFullGrid,
    });
    if (isFullGrid) break;
  }

  const totalCoins = grid.reduce((sum, cell) => sum + (cell.locked ? 1 : 0), 0);
  const totalValue = grid.reduce((sum, cell) => sum + (cell.value ?? 0), 0);
  const isFullGrid = totalCoins === HOLD_WIN_GRID_SIZE;
  const multiplier = isFullGrid ? HOLD_WIN_FULL_GRID_BONUS : 1;
  const payout = Math.round(totalValue * safeBet * multiplier);

  return {
    finalGrid: cloneGrid(grid),
    totalCoins,
    totalValue,
    isFullGrid,
    payout,
    respinsUsed,
    steps,
  };
}

export function holdWinFeatureBuyCost(bet: number): number {
  if (!Number.isFinite(bet) || bet <= 0) return 0;
  return Math.round(bet * HOLD_WIN_FEATURE_BUY_COST_MULTIPLIER);
}
