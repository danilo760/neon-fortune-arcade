import {
  GOLDEN_TIGER_PAYLINES,
  goldenTigerSymbolPay,
  pickGoldenTigerSymbol,
  type GoldenTigerSymbolId,
} from "./goldenTigerMath";

export const FORTUNE_FEATURE_TRIGGER_CHANCE = 0.0099;
export const FORTUNE_FEATURE_FULL_GRID_MULTIPLIER = 10;

/**
 * These are Neon Fortune calibration values, not published PG SOFT reel weights.
 * Public Fortune Tiger material describes the selected-symbol/Wild/blank mechanic,
 * but does not publish the internal feature strip probabilities.
 */
export const NEON_FORTUNE_SELECTED_LAND_CHANCE = 0.1;
export const NEON_FORTUNE_WILD_LAND_CHANCE = 0.01;
const FEATURE_SAFETY_RESPIN_CAP = 64;

export type FortuneFeatureCell = GoldenTigerSymbolId | null;

export type FortuneFeatureStep = {
  grid: FortuneFeatureCell[];
  addedIndices: number[];
  respin: number;
  isFullGrid: boolean;
  ended: boolean;
};

export type FortuneFeatureResult = {
  selectedSymbol: GoldenTigerSymbolId;
  finalGrid: FortuneFeatureCell[];
  steps: FortuneFeatureStep[];
  winning: Set<number>;
  lines: number;
  payout: number;
  isFullGrid: boolean;
  respinsUsed: number;
};

function unitRoll(rng: () => number) {
  const value = rng();
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(0.999999999999, value));
}

export function rollFortuneFeatureTrigger(rng: () => number = Math.random) {
  return unitRoll(rng) < FORTUNE_FEATURE_TRIGGER_CHANCE;
}

export function pickFortuneFeatureSymbol(rng: () => number = Math.random): GoldenTigerSymbolId {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const symbol = pickGoldenTigerSymbol(rng);
    if (symbol !== "wild") return symbol;
  }
  return "orange";
}

export function evaluateFortuneFeatureGrid(
  grid: readonly FortuneFeatureCell[],
  selectedSymbol: GoldenTigerSymbolId,
  bet: number,
) {
  if (grid.length !== 9 || selectedSymbol === "wild" || !Number.isFinite(bet) || bet <= 0) {
    return { payout: 0, winning: new Set<number>(), lines: 0, isFullGrid: false };
  }

  let rawPayout = 0;
  let lines = 0;
  const winning = new Set<number>();

  for (const line of GOLDEN_TIGER_PAYLINES) {
    const symbols = line.map((index) => grid[index] ?? null);
    if (symbols.some((symbol) => symbol === null)) continue;
    if (!symbols.every((symbol) => symbol === selectedSymbol || symbol === "wild")) continue;

    const allWild = symbols.every((symbol) => symbol === "wild");
    rawPayout += bet * goldenTigerSymbolPay(allWild ? "wild" : selectedSymbol);
    lines += 1;
    line.forEach((index) => winning.add(index));
  }

  const isFullGrid = grid.every((symbol) => symbol !== null);
  const payout = Math.round(
    rawPayout * (isFullGrid ? FORTUNE_FEATURE_FULL_GRID_MULTIPLIER : 1),
  );

  return { payout, winning, lines, isFullGrid };
}

export function runFortuneFeature(
  bet: number,
  rng: () => number = Math.random,
  selectedSymbol = pickFortuneFeatureSymbol(rng),
): FortuneFeatureResult {
  const safeSelected = selectedSymbol === "wild" ? "orange" : selectedSymbol;
  const grid: FortuneFeatureCell[] = Array.from({ length: 9 }, () => null);
  const steps: FortuneFeatureStep[] = [];
  let respinsUsed = 0;

  while (respinsUsed < FEATURE_SAFETY_RESPIN_CAP) {
    respinsUsed += 1;
    const addedIndices: number[] = [];

    for (let index = 0; index < grid.length; index += 1) {
      if (grid[index] !== null) continue;
      const roll = unitRoll(rng);
      if (roll < NEON_FORTUNE_WILD_LAND_CHANCE) {
        grid[index] = "wild";
        addedIndices.push(index);
      } else if (roll < NEON_FORTUNE_WILD_LAND_CHANCE + NEON_FORTUNE_SELECTED_LAND_CHANCE) {
        grid[index] = safeSelected;
        addedIndices.push(index);
      }
    }

    const isFullGrid = grid.every((symbol) => symbol !== null);
    const ended = addedIndices.length === 0 || isFullGrid;
    steps.push({
      grid: [...grid],
      addedIndices,
      respin: respinsUsed,
      isFullGrid,
      ended,
    });

    if (ended) break;
  }

  const evaluated = evaluateFortuneFeatureGrid(grid, safeSelected, bet);
  return {
    selectedSymbol: safeSelected,
    finalGrid: [...grid],
    steps,
    winning: evaluated.winning,
    lines: evaluated.lines,
    payout: evaluated.payout,
    isFullGrid: evaluated.isFullGrid,
    respinsUsed,
  };
}
