export type GoldenTigerSymbolId =
  | "wild"
  | "scatter"
  | "ingot"
  | "orange"
  | "fortuneBag"
  | "firecracker"
  | "jade"
  | "lantern"
  | "lion";

export type GoldenTigerMode = "base" | "freeSpins";

export type GoldenTigerWinTier = "none" | "small" | "nice" | "big" | "mega";

type SymbolDef = {
  id: GoldenTigerSymbolId;
  pay: number;
  baseWeight: number;
  freeSpinsWeight: number;
};

export type GoldenTigerSpinResult = {
  payout: number;
  winning: Set<number>;
  scatterIndexes: Set<number>;
  scatterCount: number;
  bonusAward: number;
  lines: number;
};

export const GOLDEN_TIGER_MAX_RETRIGGERS = 2;
export const GOLDEN_TIGER_FEATURE_BUY_INITIAL_SPINS = 8;
export const GOLDEN_TIGER_FEATURE_BUY_TARGET_RETURN = 0.95;
/**
 * Calibrated from purchased-feature Monte Carlo without changing reel or bonus math.
 * 8-spin Golden Fortune averaged about 13.85x bet; 14.5x prices the feature near 95% return.
 */
export const GOLDEN_TIGER_FEATURE_BUY_COST_MULTIPLIER = 14.5;

export const GOLDEN_TIGER_PAYLINES = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [0, 6, 12, 8, 4],
  [10, 6, 2, 8, 14],
  [0, 1, 7, 3, 4],
  [10, 11, 7, 13, 14],
  [5, 1, 2, 3, 9],
  [5, 11, 12, 13, 9],
  [0, 6, 7, 8, 14],
] as const;

const SYMBOLS: readonly SymbolDef[] = [
  { id: "wild", pay: 12, baseWeight: 5, freeSpinsWeight: 5 },
  { id: "scatter", pay: 0, baseWeight: 3.4, freeSpinsWeight: 3 },
  { id: "lion", pay: 8, baseWeight: 8, freeSpinsWeight: 8 },
  { id: "ingot", pay: 6, baseWeight: 11, freeSpinsWeight: 11 },
  { id: "fortuneBag", pay: 5, baseWeight: 13, freeSpinsWeight: 13 },
  { id: "firecracker", pay: 4, baseWeight: 15, freeSpinsWeight: 15 },
  { id: "jade", pay: 3.2, baseWeight: 17, freeSpinsWeight: 17 },
  { id: "lantern", pay: 2.6, baseWeight: 19, freeSpinsWeight: 19 },
  { id: "orange", pay: 2.1, baseWeight: 22, freeSpinsWeight: 22 },
];

const SYMBOL_BY_ID = new Map(SYMBOLS.map((symbol) => [symbol.id, symbol]));

function weightFor(symbol: SymbolDef, mode: GoldenTigerMode) {
  return mode === "freeSpins" ? symbol.freeSpinsWeight : symbol.baseWeight;
}

function totalWeight(mode: GoldenTigerMode) {
  return SYMBOLS.reduce((sum, symbol) => sum + weightFor(symbol, mode), 0);
}

export function goldenTigerFeatureBuyCost(bet: number) {
  if (!Number.isFinite(bet) || bet <= 0) return 0;
  return Math.round(bet * GOLDEN_TIGER_FEATURE_BUY_COST_MULTIPLIER);
}

export function pickGoldenTigerSymbol(
  mode: GoldenTigerMode,
  rng: () => number = Math.random,
): GoldenTigerSymbolId {
  let roll = rng() * totalWeight(mode);
  for (const symbol of SYMBOLS) {
    roll -= weightFor(symbol, mode);
    if (roll <= 0) return symbol.id;
  }
  return "orange";
}

export function makeGoldenTigerGrid(
  mode: GoldenTigerMode,
  rng: () => number = Math.random,
): GoldenTigerSymbolId[] {
  return Array.from({ length: 15 }, () => pickGoldenTigerSymbol(mode, rng));
}

export function goldenTigerBonusForScatters(count: number, mode: GoldenTigerMode) {
  if (mode === "freeSpins") {
    if (count >= 5) return 12;
    if (count === 4) return 8;
    if (count === 3) return 5;
    return 0;
  }

  if (count >= 5) return 20;
  if (count === 4) return 12;
  if (count === 3) return 8;
  return 0;
}

export function evaluateGoldenTiger(
  grid: readonly GoldenTigerSymbolId[],
  bet: number,
  mode: GoldenTigerMode,
): GoldenTigerSpinResult {
  let payout = 0;
  let lines = 0;
  const winning = new Set<number>();
  const scatterIndexes = new Set<number>();

  grid.forEach((symbol, index) => {
    if (symbol === "scatter") scatterIndexes.add(index);
  });

  for (const line of GOLDEN_TIGER_PAYLINES) {
    const firstIndex = line[0];
    const first = grid[firstIndex];
    if (!first || first === "scatter") continue;

    let target: GoldenTigerSymbolId = first;
    if (target === "wild") {
      for (const position of line) {
        const candidate = grid[position];
        if (candidate && candidate !== "wild" && candidate !== "scatter") {
          target = candidate;
          break;
        }
      }
    }

    let count = 0;
    const matched: number[] = [];
    for (const position of line) {
      const current = grid[position];
      if (current === target || current === "wild") {
        count += 1;
        matched.push(position);
      } else {
        break;
      }
    }

    if (count < 3) continue;
    const def = SYMBOL_BY_ID.get(target) ?? SYMBOL_BY_ID.get("wild");
    if (!def) continue;
    const lengthBoost = count === 5 ? 2.5 : count === 4 ? 1.6 : 1;
    payout += bet * def.pay * lengthBoost;
    lines += 1;
    matched.forEach((position) => winning.add(position));
  }

  return {
    payout: Math.round(payout),
    winning,
    scatterIndexes,
    scatterCount: scatterIndexes.size,
    bonusAward: goldenTigerBonusForScatters(scatterIndexes.size, mode),
    lines,
  };
}

export function goldenTigerWinTier(payout: number, bet: number): GoldenTigerWinTier {
  if (bet <= 0 || payout < bet * 2) return "none";
  if (payout < bet * 5) return "small";
  if (payout < bet * 15) return "nice";
  if (payout < bet * 30) return "big";
  return "mega";
}

export function goldenTigerScatterProbability(mode: GoldenTigerMode) {
  const scatter = SYMBOL_BY_ID.get("scatter");
  if (!scatter) return 0;
  return weightFor(scatter, mode) / totalWeight(mode);
}

export function goldenTigerTriggerProbability(mode: GoldenTigerMode) {
  const p = goldenTigerScatterProbability(mode);
  const n = 15;
  const choose = (total: number, selected: number) => {
    let value = 1;
    for (let index = 1; index <= selected; index += 1) {
      value = (value * (total - selected + index)) / index;
    }
    return value;
  };

  let belowTrigger = 0;
  for (let count = 0; count < 3; count += 1) {
    belowTrigger += choose(n, count) * p ** count * (1 - p) ** (n - count);
  }
  return 1 - belowTrigger;
}
