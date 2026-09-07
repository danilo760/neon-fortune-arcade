export type GoldenTigerSymbolId =
  | "wild"
  | "ingot"
  | "jade"
  | "bag"
  | "firecracker"
  | "lantern"
  | "orange";

export type GoldenTigerWinTier = "none" | "small" | "nice" | "big" | "mega" | "epic";

export interface SymbolConfig {
  id: GoldenTigerSymbolId;
  name: string;
  symbolMultiplier: number; // Multiplicador para 3 símbolos iguais na linha
  baseWeight: number;       // Peso na distribuição do giro base
  respinWeight: number;     // Peso na distribuição durante o Lucky Tiger Respin
  glowColor: string;
  accentColor: string;
}

/**
 * 5 Linhas fixas de pagamento para a grade 3x3 (índices de 0 a 8):
 * [0] [1] [2]  (Linha 2 - Superior)
 * [3] [4] [5]  (Linha 1 - Central)
 * [6] [7] [8]  (Linha 3 - Inferior)
 * Diagonais: [0, 4, 8] (Linha 4) e [6, 4, 2] (Linha 5)
 */
export const GOLDEN_TIGER_PAYLINES = [
  [3, 4, 5], // Linha 1 - Central horizontal
  [0, 1, 2], // Linha 2 - Superior horizontal
  [6, 7, 8], // Linha 3 - Inferior horizontal
  [0, 4, 8], // Linha 4 - Diagonal descendo
  [6, 4, 2], // Linha 5 - Diagonal subindo
] as const;

export const GOLDEN_TIGER_SYMBOLS: Record<GoldenTigerSymbolId, SymbolConfig> = {
  wild: {
    id: "wild",
    name: "Tigre Dourado",
    symbolMultiplier: 45, // 45x a aposta total por linha
    baseWeight: 4,
    respinWeight: 8,
    glowColor: "#ffd700",
    accentColor: "#ff9900",
  },
  ingot: {
    id: "ingot",
    name: "Lingote Imperial",
    symbolMultiplier: 18,
    baseWeight: 8,
    respinWeight: 12,
    glowColor: "#facc15",
    accentColor: "#ca8a04",
  },
  jade: {
    id: "jade",
    name: "Amuleto de Jade",
    symbolMultiplier: 9,
    baseWeight: 14,
    respinWeight: 16,
    glowColor: "#2dd4bf",
    accentColor: "#0d9488",
  },
  bag: {
    id: "bag",
    name: "Bolsa da Fortuna",
    symbolMultiplier: 4.5,
    baseWeight: 20,
    respinWeight: 22,
    glowColor: "#f43f5e",
    accentColor: "#be123c",
  },
  firecracker: {
    id: "firecracker",
    name: "Fogos Neon",
    symbolMultiplier: 2.8,
    baseWeight: 28,
    respinWeight: 26,
    glowColor: "#fb923c",
    accentColor: "#c2410c",
  },
  lantern: {
    id: "lantern",
    name: "Lanterna Mística",
    symbolMultiplier: 1.9,
    baseWeight: 34,
    respinWeight: 30,
    glowColor: "#ec4899",
    accentColor: "#be185d",
  },
  orange: {
    id: "orange",
    name: "Tangerina da Sorte",
    symbolMultiplier: 1.3,
    baseWeight: 44,
    respinWeight: 36,
    glowColor: "#f97316",
    accentColor: "#ea580c",
  },
};

export const SYMBOL_ORDER: readonly GoldenTigerSymbolId[] = [
  "wild",
  "ingot",
  "jade",
  "bag",
  "firecracker",
  "lantern",
  "orange",
];

export const REGULAR_SYMBOLS = SYMBOL_ORDER.filter((s): s is Exclude<GoldenTigerSymbolId, "wild"> => s !== "wild");

export const FULL_GRID_MULTIPLIER = 10;
export const LUCKY_TIGER_CHANCE = 0.024; // ~1 em 42 rodadas

export const BET_STEPS = [10, 50, 100, 200, 500, 1_000, 5_000, 10_000] as const;

export const MOTION_TIMINGS = {
  normal: {
    anticipationPullback: 80,
    spinAcceleration: 220,
    spinCruise: 380,
    columnDecelStagger: 140,
    landingBounce: 180,
  },
  turbo: {
    anticipationPullback: 0,
    spinAcceleration: 100,
    spinCruise: 120,
    columnDecelStagger: 50,
    landingBounce: 120,
  },
} as const;
