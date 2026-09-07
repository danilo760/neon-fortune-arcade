import {
  FULL_GRID_MULTIPLIER,
  GOLDEN_TIGER_PAYLINES,
  GOLDEN_TIGER_SYMBOLS,
  REGULAR_SYMBOLS,
  SYMBOL_ORDER,
  type GoldenTigerSymbolId,
  type GoldenTigerWinTier,
} from "./goldenTigerConfig";

export interface LineWin {
  lineIndex: number;
  positions: readonly [number, number, number];
  symbol: GoldenTigerSymbolId;
  multiplier: number;
  payout: number;
}

export interface SpinEvaluation {
  payout: number;
  basePayout: number;
  multiplier: number;
  isFullGrid: boolean;
  winningIndices: Set<number>;
  lines: LineWin[];
  tier: GoldenTigerWinTier;
}

const BASE_TOTAL_WEIGHT = SYMBOL_ORDER.reduce(
  (sum, id) => sum + GOLDEN_TIGER_SYMBOLS[id].baseWeight,
  0,
);

const RESPIN_TOTAL_WEIGHT = SYMBOL_ORDER.reduce(
  (sum, id) => sum + GOLDEN_TIGER_SYMBOLS[id].respinWeight,
  0,
);

/** Sorteia um símbolo usando os pesos configurados para base ou respin */
export function pickSymbol(
  mode: "base" | "respin",
  rng: () => number = Math.random,
): GoldenTigerSymbolId {
  const isRespin = mode === "respin";
  let roll = rng() * (isRespin ? RESPIN_TOTAL_WEIGHT : BASE_TOTAL_WEIGHT);

  for (const id of SYMBOL_ORDER) {
    const weight = isRespin
      ? GOLDEN_TIGER_SYMBOLS[id].respinWeight
      : GOLDEN_TIGER_SYMBOLS[id].baseWeight;
    roll -= weight;
    if (roll <= 0) return id;
  }
  return "orange";
}

/** Gera uma grade 3x3 (9 posições) de símbolos */
export function generateGrid(
  mode: "base" | "respin" = "base",
  rng: () => number = Math.random,
): GoldenTigerSymbolId[] {
  return Array.from({ length: 9 }, () => pickSymbol(mode, rng));
}

/** Avalia uma linha de 3 posições e retorna a vitória, se houver */
export function evaluateLine(
  positions: readonly [number, number, number],
  grid: readonly GoldenTigerSymbolId[],
  bet: number,
  lineIndex: number,
): LineWin | null {
  const [p0, p1, p2] = positions;
  const s0 = grid[p0];
  const s1 = grid[p1];
  const s2 = grid[p2];

  if (!s0 || !s1 || !s2) return null;

  // Caso 1: Três Wilds
  if (s0 === "wild" && s1 === "wild" && s2 === "wild") {
    const mult = GOLDEN_TIGER_SYMBOLS.wild.symbolMultiplier;
    return {
      lineIndex,
      positions,
      symbol: "wild",
      multiplier: mult,
      payout: Math.round(bet * mult),
    };
  }

  // Identifica o símbolo regular alvo (o primeiro que não for Wild)
  const target = s0 !== "wild" ? s0 : s1 !== "wild" ? s1 : s2;

  // Verifica se todos os 3 são target ou Wild
  const match0 = s0 === target || s0 === "wild";
  const match1 = s1 === target || s1 === "wild";
  const match2 = s2 === target || s2 === "wild";

  if (match0 && match1 && match2) {
    const mult = GOLDEN_TIGER_SYMBOLS[target].symbolMultiplier;
    return {
      lineIndex,
      positions,
      symbol: target,
      multiplier: mult,
      payout: Math.round(bet * mult),
    };
  }

  return null;
}

/** Avalia o resultado completo de uma grade de 9 células */
export function evaluateGrid(
  grid: readonly GoldenTigerSymbolId[],
  bet: number,
): SpinEvaluation {
  if (grid.length !== 9 || bet <= 0) {
    return {
      payout: 0,
      basePayout: 0,
      multiplier: 1,
      isFullGrid: false,
      winningIndices: new Set(),
      lines: [],
      tier: "none",
    };
  }

  const lines: LineWin[] = [];
  const winningIndices = new Set<number>();
  let basePayout = 0;

  for (let i = 0; i < GOLDEN_TIGER_PAYLINES.length; i++) {
    const linePositions = GOLDEN_TIGER_PAYLINES[i];
    if (!linePositions) continue;
    const win = evaluateLine(linePositions, grid, bet, i);
    if (win) {
      lines.push(win);
      basePayout += win.payout;
      linePositions.forEach((idx) => winningIndices.add(idx));
    }
  }

  // Checagem de Tela Cheia (Full Grid):
  // 1. Todas as 5 linhas devem ter ganho (winningIndices tem 9 posições)
  // 2. Não pode haver mais de um tipo de símbolo regular diferente na tela
  const nonWildSymbols = new Set(grid.filter((s) => s !== "wild"));
  const isFullGrid =
    winningIndices.size === 9 &&
    lines.length === 5 &&
    nonWildSymbols.size <= 1;

  const multiplier = isFullGrid ? FULL_GRID_MULTIPLIER : 1;
  const payout = Math.round(basePayout * multiplier);
  const tier = deriveWinTier(payout, bet);

  return {
    payout,
    basePayout: Math.round(basePayout),
    multiplier,
    isFullGrid,
    winningIndices,
    lines,
    tier,
  };
}

/** Determina o tier de vitória baseado no múltiplo da aposta */
export function deriveWinTier(payout: number, bet: number): GoldenTigerWinTier {
  if (bet <= 0 || payout <= 0) return "none";
  const multiple = payout / bet;
  if (multiple < 2) return "small";
  if (multiple < 10) return "nice";
  if (multiple < 25) return "big";
  if (multiple < 50) return "mega";
  return "epic";
}

/** Escolhe o símbolo regular alvo para o Lucky Tiger Respin */
export function pickRespinTarget(
  grid: readonly GoldenTigerSymbolId[],
  rng: () => number = Math.random,
): Exclude<GoldenTigerSymbolId, "wild"> {
  // Dá preferência a símbolos regulares que já estejam na grade inicial
  const regularOnGrid = grid.filter((s): s is Exclude<GoldenTigerSymbolId, "wild"> => s !== "wild");
  if (regularOnGrid.length > 0) {
    const chosenIndex = Math.floor(rng() * regularOnGrid.length);
    return regularOnGrid[chosenIndex] ?? "orange";
  }
  // Se a grade tiver só Wilds ou vazia, escolhe aleatoriamente dos regulares
  const fallbackIndex = Math.floor(rng() * REGULAR_SYMBOLS.length);
  return REGULAR_SYMBOLS[fallbackIndex] ?? "orange";
}

export interface RespinStepResult {
  grid: GoldenTigerSymbolId[];
  lockedIndices: Set<number>;
  addedIndices: Set<number>;
  hasNewLocked: boolean;
  isFull: boolean;
}

/** Executa um único passo de respin sobre as células não travadas */
export function executeRespinStep(
  currentGrid: readonly GoldenTigerSymbolId[],
  targetSymbol: GoldenTigerSymbolId,
  currentLocked: ReadonlySet<number>,
  rng: () => number = Math.random,
): RespinStepResult {
  const nextGrid: GoldenTigerSymbolId[] = [...currentGrid];
  const nextLocked = new Set(currentLocked);
  const addedIndices = new Set<number>();

  for (let i = 0; i < 9; i++) {
    if (!currentLocked.has(i)) {
      const rolled = pickSymbol("respin", rng);
      nextGrid[i] = rolled;
      if (rolled === targetSymbol || rolled === "wild") {
        nextLocked.add(i);
        addedIndices.add(i);
      }
    }
  }

  return {
    grid: nextGrid,
    lockedIndices: nextLocked,
    addedIndices,
    hasNewLocked: addedIndices.size > 0,
    isFull: nextLocked.size === 9,
  };
}
