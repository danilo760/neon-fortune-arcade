export type GoldenTigerSymbolId = "wild" | "scatter" | "ingot" | "orange" | "fortuneBag" | "firecracker" | "jade" | "lantern" | "lion";
export type GoldenTigerMode = "base" | "respin" | "freeSpins";
export type GoldenTigerWinTier = "none" | "small" | "nice" | "big" | "mega";
type SymbolDef = { id: GoldenTigerSymbolId; pay: number; weight: number };

export type GoldenTigerSpinResult = { payout: number; winning: Set<number>; scatterIndexes: Set<number>; scatterCount: number; bonusAward: number; lines: number; isFullGrid: boolean };
export type GoldenTigerRespinState = { target: Exclude<GoldenTigerSymbolId, "scatter">; locked: Set<number>; spinsLeft: number };

export const GOLDEN_TIGER_PAYLINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 4, 8], [2, 4, 6]] as const;
export const GOLDEN_TIGER_MAX_RETRIGGERS = 2;
export const GOLDEN_TIGER_FEATURE_BUY_INITIAL_SPINS = 8;
export const GOLDEN_TIGER_FEATURE_BUY_COST_MULTIPLIER = 14.5;
export function goldenTigerFeatureBuyCost(bet: number) { return Number.isFinite(bet) && bet > 0 ? Math.round(bet * GOLDEN_TIGER_FEATURE_BUY_COST_MULTIPLIER) : 0; }
const SYMBOLS: readonly SymbolDef[] = [
  { id: "wild", pay: 25, weight: 4 }, { id: "scatter", pay: 0, weight: 5 }, { id: "lion", pay: 10, weight: 8 },
  { id: "ingot", pay: 8, weight: 11 }, { id: "fortuneBag", pay: 5, weight: 14 }, { id: "firecracker", pay: 3, weight: 17 },
  { id: "jade", pay: 2.4, weight: 20 }, { id: "lantern", pay: 1.8, weight: 23 }, { id: "orange", pay: 1.2, weight: 27 },
];
const SYMBOL_BY_ID = new Map(SYMBOLS.map((symbol) => [symbol.id, symbol]));
const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);

export function pickGoldenTigerSymbol(_mode: GoldenTigerMode, rng: () => number = Math.random): GoldenTigerSymbolId {
  let roll = rng() * TOTAL_WEIGHT;
  for (const symbol of SYMBOLS) { roll -= symbol.weight; if (roll <= 0) return symbol.id; }
  return "orange";
}
export function makeGoldenTigerGrid(mode: GoldenTigerMode, rng: () => number = Math.random) { return Array.from({ length: 9 }, () => pickGoldenTigerSymbol(mode, rng)); }

export function evaluateGoldenTiger(grid: readonly GoldenTigerSymbolId[], bet: number, _mode: GoldenTigerMode): GoldenTigerSpinResult {
  const winning = new Set<number>(); const scatterIndexes = new Set<number>(); let payout = 0; let lines = 0;
  grid.forEach((symbol, index) => { if (symbol === "scatter") scatterIndexes.add(index); });
  for (const line of GOLDEN_TIGER_PAYLINES) {
    const target = line.map((index) => grid[index]).find((symbol) => symbol && symbol !== "wild" && symbol !== "scatter") ?? "wild";
    const matched = line.filter((index) => grid[index] === target || grid[index] === "wild");
    if (matched.length !== 3 || target === "scatter") continue;
    payout += bet * (SYMBOL_BY_ID.get(target)?.pay ?? 0); lines += 1; matched.forEach((index) => winning.add(index));
  }
  const isFullGrid = grid.length === 9 && grid.every((symbol) => symbol === grid[0] || symbol === "wild");
  if (isFullGrid && payout > 0) payout *= 10;
  return { payout: Math.round(payout), winning, scatterIndexes, scatterCount: scatterIndexes.size, bonusAward: 0, lines, isFullGrid };
}

export function createGoldenTigerRespin(grid: readonly GoldenTigerSymbolId[], rng: () => number = Math.random): GoldenTigerRespinState | null {
  if (rng() >= 0.05) return null;
  const candidates = [...new Set(grid.filter((symbol): symbol is Exclude<GoldenTigerSymbolId, "scatter"> => symbol !== "scatter"))];
  const target = candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
  if (!target) return null;
  const locked = new Set<number>(); grid.forEach((symbol, index) => { if (symbol === target || symbol === "wild") locked.add(index); });
  return locked.size ? { target, locked, spinsLeft: 3 } : null;
}
export function respinGoldenTigerGrid(grid: readonly GoldenTigerSymbolId[], state: GoldenTigerRespinState, rng: () => number = Math.random) {
  const next = grid.map((symbol, index) => state.locked.has(index) ? symbol : pickGoldenTigerSymbol("respin", rng));
  const locked = new Set(state.locked); next.forEach((symbol, index) => { if (symbol === state.target || symbol === "wild") locked.add(index); });
  return { grid: next, state: { ...state, locked, spinsLeft: locked.size > state.locked.size ? 3 : state.spinsLeft - 1 } };
}
export function goldenTigerWinTier(payout: number, bet: number): GoldenTigerWinTier {
  if (bet <= 0 || payout < bet * 2) return "none"; if (payout < bet * 5) return "small"; if (payout < bet * 15) return "nice"; if (payout < bet * 30) return "big"; return "mega";
}
