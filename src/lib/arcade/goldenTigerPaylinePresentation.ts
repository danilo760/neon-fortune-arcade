import { evaluateFortuneFeatureGrid, type FortuneFeatureCell } from "./goldenTigerFortuneFeature";
import {
  evaluateGoldenTiger,
  GOLDEN_TIGER_PAYLINES,
  type GoldenTigerSymbolId,
} from "./goldenTigerMath";

export type GoldenTigerPaylinePresentation = {
  index: number;
  cells: readonly number[];
  payout: number;
  points: string;
};

function pointsForLine(cells: readonly number[]) {
  return cells
    .map((index) => `${(index % 3) + 0.5},${Math.floor(index / 3) + 0.5}`)
    .join(" ");
}

function presentation(index: number, cells: readonly number[], payout: number): GoldenTigerPaylinePresentation {
  return {
    index,
    cells: [...cells],
    payout,
    points: pointsForLine(cells),
  };
}

/**
 * Presentation-only helper. It asks the existing evaluator whether each fixed
 * payline wins by blocking every cell outside that line. It never calculates
 * or mutates the round result used for settlement.
 */
export function resolveGoldenTigerBasePaylines(
  grid: readonly GoldenTigerSymbolId[],
  bet: number,
): GoldenTigerPaylinePresentation[] {
  return GOLDEN_TIGER_PAYLINES.flatMap((line, index) => {
    const allowed = new Set<number>(line);
    const blocked = new Set<number>();
    for (let cell = 0; cell < 9; cell += 1) {
      if (!allowed.has(cell)) blocked.add(cell);
    }

    const result = evaluateGoldenTiger(grid, bet, blocked);
    return result.lines > 0 ? [presentation(index, line, result.payout)] : [];
  });
}

/**
 * Fortune Feature equivalent. Cells outside the line are blanked in a copy,
 * so the engine's existing feature evaluator remains the single source of
 * truth for whether that line wins. Full-grid ×10 stays in the final engine
 * result and is intentionally not applied to each line presentation.
 */
export function resolveGoldenTigerFeaturePaylines(
  grid: readonly FortuneFeatureCell[],
  selectedSymbol: GoldenTigerSymbolId,
  bet: number,
): GoldenTigerPaylinePresentation[] {
  return GOLDEN_TIGER_PAYLINES.flatMap((line, index) => {
    const allowed = new Set<number>(line);
    const isolated = grid.map((symbol, cell) => (allowed.has(cell) ? symbol : null));
    const result = evaluateFortuneFeatureGrid(isolated, selectedSymbol, bet);
    return result.lines > 0 ? [presentation(index, line, result.payout)] : [];
  });
}
