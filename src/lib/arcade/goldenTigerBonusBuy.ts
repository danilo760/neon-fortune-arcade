import {
  evaluateFortuneFeatureGrid,
  pickFortuneFeatureSymbol,
  type FortuneFeatureCell,
  type FortuneFeatureResult,
  type FortuneFeatureStep,
} from "./goldenTigerFortuneFeature";
import { resolveGoldenTigerVisualQaRng } from "./goldenTigerVisualQaRng";

/**
 * Purchased Fortune Feature is an original Neon Fortune product, not a
 * published PG SOFT mechanic. It is calibrated independently from the rare
 * natural Fortune Feature so the purchase has a meaningful visual session
 * and an expected fictional return close to the rest of the arcade.
 */
export const GOLDEN_TIGER_BONUS_BUY_MULTIPLIER = 32;
export const GOLDEN_TIGER_BUY_SELECTED_LAND_CHANCE = 0.25;
export const GOLDEN_TIGER_BUY_WILD_LAND_CHANCE = 0.025;
const PURCHASED_FEATURE_SAFETY_RESPIN_CAP = 64;

function unitRoll(rng: () => number) {
  const value = rng();
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(0.999999999999, value));
}

export function runPurchasedFortuneFeature(
  bet: number,
  rng: () => number = Math.random,
): FortuneFeatureResult {
  const resolvedRng = resolveGoldenTigerVisualQaRng(rng);
  const selectedSymbol = pickFortuneFeatureSymbol(resolvedRng);
  const grid: FortuneFeatureCell[] = Array.from({ length: 9 }, () => null);
  const steps: FortuneFeatureStep[] = [];
  let respinsUsed = 0;

  while (respinsUsed < PURCHASED_FEATURE_SAFETY_RESPIN_CAP) {
    respinsUsed += 1;
    const addedIndices: number[] = [];

    for (let index = 0; index < grid.length; index += 1) {
      if (grid[index] !== null) continue;
      const roll = unitRoll(resolvedRng);
      if (roll < GOLDEN_TIGER_BUY_WILD_LAND_CHANCE) {
        grid[index] = "wild";
        addedIndices.push(index);
      } else if (
        roll < GOLDEN_TIGER_BUY_WILD_LAND_CHANCE + GOLDEN_TIGER_BUY_SELECTED_LAND_CHANCE
      ) {
        grid[index] = selectedSymbol;
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

  const evaluated = evaluateFortuneFeatureGrid(grid, selectedSymbol, bet);
  return {
    selectedSymbol,
    finalGrid: [...grid],
    steps,
    winning: evaluated.winning,
    lines: evaluated.lines,
    payout: evaluated.payout,
    isFullGrid: evaluated.isFullGrid,
    respinsUsed,
  };
}
