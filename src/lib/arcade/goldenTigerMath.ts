export type GoldenTigerSymbolId =
  | "wild"
  | "lion"
  | "ingot"
  | "fortuneBag"
  | "firecracker"
  | "jade"
  | "lantern"
  | "orange";

export type GoldenTigerWinTier = "none" | "small" | "nice" | "big" | "mega";

type SymbolDef = {
  id: GoldenTigerSymbolId;
  pay: number;
  weight: number;
};

export type GoldenTigerSpinResult = {
  payout: number;
  winning: Set<number>;
  lines: number;
};

export const GOLDEN_TIGER_PAYLINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 4, 8],
  [6, 4, 2],
] as const;

const SYMBOLS: readonly SymbolDef[] = [
  { id: "wild", pay: 12, weight: 5 },
  { id: "lion", pay: 8, weight: 8 },
  { id: "ingot", pay: 6, weight: 11 },
  { id: "fortuneBag", pay: 5, weight: 13 },
  { id: "firecracker", pay: 4, weight: 15 },
  { id: "jade", pay: 3.2, weight: 17 },
  { id: "lantern", pay: 2.6, weight: 19 },
  { id: "orange", pay: 2.1, weight: 22 },
];

const SYMBOL_BY_ID = new Map(SYMBOLS.map((symbol) => [symbol.id, symbol]));
const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);

export function pickGoldenTigerSymbol(
  rng: () => number = Math.random,
): GoldenTigerSymbolId {
  const raw = rng();
  const normalized = Number.isFinite(raw) ? Math.max(0, Math.min(0.999999999999, raw)) : 0;
  let roll = normalized * TOTAL_WEIGHT;
  for (const symbol of SYMBOLS) {
    roll -= symbol.weight;
    if (roll < 0) return symbol.id;
  }
  return "orange";
}

export function makeGoldenTigerGrid(
  rng: () => number = Math.random,
): GoldenTigerSymbolId[] {
  return Array.from({ length: 9 }, () => pickGoldenTigerSymbol(rng));
}

/**
 * Gold Coins are visual/feature symbols and never participate in base paylines.
 * Their indexes are passed as blocked cells so a line containing a feature coin
 * cannot win using the hidden regular symbol underneath it.
 */
export function evaluateGoldenTiger(
  grid: readonly GoldenTigerSymbolId[],
  bet: number,
  blockedIndices: ReadonlySet<number> = new Set(),
): GoldenTigerSpinResult {
  if (grid.length !== 9 || !Number.isFinite(bet) || bet <= 0) {
    return { payout: 0, winning: new Set(), lines: 0 };
  }

  let payout = 0;
  let lines = 0;
  const winning = new Set<number>();

  for (const line of GOLDEN_TIGER_PAYLINES) {
    if (line.some((position) => blockedIndices.has(position))) continue;
    const first = grid[line[0]];
    if (!first) continue;

    let target: GoldenTigerSymbolId = first;
    if (target === "wild") {
      const regular = line
        .map((position) => grid[position])
        .find((symbol): symbol is GoldenTigerSymbolId => Boolean(symbol && symbol !== "wild"));
      target = regular ?? "wild";
    }

    const matched = line.every((position) => {
      const symbol = grid[position];
      return symbol === target || symbol === "wild";
    });
    if (!matched) continue;

    const def = SYMBOL_BY_ID.get(target) ?? SYMBOL_BY_ID.get("wild");
    if (!def) continue;
    payout += bet * def.pay;
    lines += 1;
    line.forEach((position) => winning.add(position));
  }

  return { payout: Math.round(payout), winning, lines };
}

export function goldenTigerWinTier(payout: number, bet: number): GoldenTigerWinTier {
  if (bet <= 0 || payout < bet * 2) return "none";
  if (payout < bet * 5) return "small";
  if (payout < bet * 15) return "nice";
  if (payout < bet * 30) return "big";
  return "mega";
}
