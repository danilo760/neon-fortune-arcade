import type { SlotConfig } from "./slot-engine";

export const BET_STEPS = [10, 50, 100, 500, 1_000, 5_000, 10_000] as const;

/** Golden Tiger — original 3x3, 5 fixed lines. */
export const GOLDEN_TIGER: SlotConfig = {
  slug: "golden-tiger",
  name: "Golden Tiger",
  cols: 3,
  rows: 3,
  mode: "lines",
  wildId: "wild",
  bonusId: "bonus",
  bonusTriggerCount: 3,
  freeSpinsAwarded: 8,
  winMultiplierChance: 0.18,
  winMultiplierValues: [2, 3, 5],
  paytableNote:
    "5 linhas fixas: 3 horizontais e 2 diagonais. O Wild substitui qualquer símbolo comum. 3 símbolos Bônus concedem 8 giros grátis.",
  lines: [
    [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    [
      [2, 0],
      [1, 1],
      [0, 2],
    ],
  ],
  symbols: [
    { id: "tiger", label: "Tigre Dourado", glyph: "🐅", weight: 6, linePays: { 2: 1, 3: 20 } },
    { id: "coin", label: "Moeda da Sorte", glyph: "🪙", weight: 10, linePays: { 3: 10 } },
    { id: "jade", label: "Jade", glyph: "🟢", weight: 12, linePays: { 3: 6 } },
    { id: "bell", label: "Sino", glyph: "🔔", weight: 14, linePays: { 3: 4 } },
    { id: "lantern", label: "Lanterna", glyph: "🏮", weight: 16, linePays: { 3: 3 } },
    { id: "bamboo", label: "Bambu", glyph: "🎍", weight: 18, linePays: { 3: 2 } },
    {
      id: "wild",
      label: "Wild Rugido",
      glyph: "🌟",
      weight: 4,
      linePays: { 2: 2, 3: 40 },
      kind: "wild",
    },
    { id: "bonus", label: "Bônus Lua", glyph: "🌙", weight: 4, kind: "bonus" },
  ],
};

/** Olympus Storm — original mythology cluster slot. */
export const OLYMPUS_STORM: SlotConfig = {
  slug: "olympus-storm",
  name: "Olympus Storm",
  cols: 6,
  rows: 5,
  mode: "cluster",
  minCluster: 5,
  multiplierChance: 0.34,
  multiplierValues: [2, 3, 5, 10, 25],
  paytableNote:
    "Pagamento por grupos conectados de 5 ou mais símbolos iguais. Grupos vencedores desaparecem e novos símbolos caem. Orbes de tempestade somam multiplicadores aplicados ao total da rodada.",
  symbols: [
    {
      id: "crown",
      label: "Coroa de Éter",
      glyph: "👑",
      weight: 5,
      clusterTiers: [
        { min: 5, multiplier: 1.2 },
        { min: 8, multiplier: 4 },
        { min: 12, multiplier: 14 },
      ],
    },
    {
      id: "bolt",
      label: "Raio",
      glyph: "⚡",
      weight: 7,
      clusterTiers: [
        { min: 5, multiplier: 0.9 },
        { min: 8, multiplier: 3 },
        { min: 12, multiplier: 10 },
      ],
    },
    {
      id: "helm",
      label: "Elmo",
      glyph: "🪖",
      weight: 9,
      clusterTiers: [
        { min: 5, multiplier: 0.6 },
        { min: 8, multiplier: 2 },
        { min: 12, multiplier: 7 },
      ],
    },
    {
      id: "chalice",
      label: "Cálice",
      glyph: "🏆",
      weight: 11,
      clusterTiers: [
        { min: 5, multiplier: 0.4 },
        { min: 8, multiplier: 1.4 },
        { min: 12, multiplier: 5 },
      ],
    },
    {
      id: "ring",
      label: "Anel",
      glyph: "💫",
      weight: 13,
      clusterTiers: [
        { min: 5, multiplier: 0.3 },
        { min: 8, multiplier: 1 },
        { min: 12, multiplier: 3.5 },
      ],
    },
    {
      id: "hourglass",
      label: "Ampulheta",
      glyph: "⏳",
      weight: 15,
      clusterTiers: [
        { min: 5, multiplier: 0.2 },
        { min: 8, multiplier: 0.8 },
        { min: 12, multiplier: 2.5 },
      ],
    },
  ],
};

/** Candy Cascade — original sweets cluster slot with bomb multipliers. */
export const CANDY_CASCADE: SlotConfig = {
  slug: "candy-cascade",
  name: "Candy Cascade",
  cols: 6,
  rows: 5,
  mode: "cluster",
  minCluster: 5,
  multiplierChance: 0.38,
  multiplierValues: [2, 3, 4, 8, 20],
  paytableNote:
    "Grupos conectados de 5 ou mais doces iguais pagam. Após cada pagamento os doces somem e novos caem. Bombas de açúcar somam multiplicadores aplicados ao total da rodada.",
  symbols: [
    {
      id: "star-drop",
      label: "Estrela de Açúcar",
      glyph: "🍭",
      weight: 5,
      clusterTiers: [
        { min: 5, multiplier: 1.3 },
        { min: 8, multiplier: 4.5 },
        { min: 12, multiplier: 15 },
      ],
    },
    {
      id: "cherry-gel",
      label: "Gel de Cereja",
      glyph: "🍒",
      weight: 8,
      clusterTiers: [
        { min: 5, multiplier: 0.9 },
        { min: 8, multiplier: 3 },
        { min: 12, multiplier: 10 },
      ],
    },
    {
      id: "melon-cube",
      label: "Cubo de Melão",
      glyph: "🍈",
      weight: 10,
      clusterTiers: [
        { min: 5, multiplier: 0.6 },
        { min: 8, multiplier: 2 },
        { min: 12, multiplier: 7 },
      ],
    },
    {
      id: "grape-bead",
      label: "Pérola de Uva",
      glyph: "🍇",
      weight: 12,
      clusterTiers: [
        { min: 5, multiplier: 0.45 },
        { min: 8, multiplier: 1.5 },
        { min: 12, multiplier: 5 },
      ],
    },
    {
      id: "lemon-chew",
      label: "Bala de Limão",
      glyph: "🍋",
      weight: 14,
      clusterTiers: [
        { min: 5, multiplier: 0.3 },
        { min: 8, multiplier: 1 },
        { min: 12, multiplier: 3.5 },
      ],
    },
    {
      id: "mint-swirl",
      label: "Espiral de Menta",
      glyph: "🌀",
      weight: 16,
      clusterTiers: [
        { min: 5, multiplier: 0.2 },
        { min: 8, multiplier: 0.75 },
        { min: 12, multiplier: 2.5 },
      ],
    },
  ],
};

export const SLOT_CONFIGS: Record<string, SlotConfig> = {
  "golden-tiger": GOLDEN_TIGER,
  "olympus-storm": OLYMPUS_STORM,
  "candy-cascade": CANDY_CASCADE,
};
