export type GameCategory = "slots" | "arcade" | "mesa";

export interface GameEntry {
  slug: string;
  name: string;
  tagline: string;
  category: GameCategory;
  playable: boolean;
  featured: boolean;
  /** Visual identity: gradient stops as oklch token expressions. */
  accent:
    | "gold"
    | "storm"
    | "candy"
    | "mine"
    | "plinko"
    | "dragon"
    | "ox"
    | "panda"
    | "classic"
    | "pirate"
    | "rocket"
    | "wheel"
    | "dice"
    | "royal"
    | "rabbit";
  emblem: string;
  volatility: string;
}

export const CATEGORY_LABELS: Record<GameCategory, string> = {
  slots: "Slots",
  arcade: "Arcade",
  mesa: "Mesa",
};

export const GAMES: readonly GameEntry[] = [
  {
    slug: "golden-tiger",
    name: "Golden Tiger",
    tagline: "Slot 3x3 · 5 linhas e Fortune Feature com símbolos fixos",
    category: "slots",
    playable: true,
    featured: true,
    accent: "gold",
    emblem: "🐅",
    volatility: "Média",
  },
  {
    slug: "olympus-storm",
    name: "Olympus Storm",
    tagline: "Slot 6x5 · Clusters, cascata e tempestade de multiplicadores",
    category: "slots",
    playable: true,
    featured: true,
    accent: "storm",
    emblem: "⚡",
    volatility: "Alta",
  },
  {
    slug: "candy-cascade",
    name: "Candy Cascade",
    tagline: "Slot 6x5 · Grupos doces e bombas multiplicadoras",
    category: "slots",
    playable: true,
    featured: true,
    accent: "candy",
    emblem: "🍬",
    volatility: "Média-alta",
  },
  {
    slug: "neon-mines",
    name: "Neon Mines",
    tagline: "Arcade 5x5 · Escolha as minas e colete antes de explodir",
    category: "arcade",
    playable: true,
    featured: true,
    accent: "mine",
    emblem: "💠",
    volatility: "Sob controle",
  },
  {
    slug: "neon-plinko",
    name: "Neon Plinko",
    tagline: "Arcade de queda · 12, 14 ou 16 linhas e risco configurável",
    category: "arcade",
    playable: true,
    featured: true,
    accent: "plinko",
    emblem: "🔮",
    volatility: "Configurável",
  },
  {
    slug: "dragon-gold",
    name: "Dragon Gold",
    tagline: "Slot premium · Em breve",
    category: "slots",
    playable: false,
    featured: false,
    accent: "dragon",
    emblem: "🐉",
    volatility: "Alta",
  },
  {
    slug: "fortune-ox",
    name: "Fortune Ox",
    tagline: "Slot premium · Em breve",
    category: "slots",
    playable: false,
    featured: false,
    accent: "ox",
    emblem: "🐂",
    volatility: "Média",
  },
  {
    slug: "lucky-panda",
    name: "Lucky Panda",
    tagline: "Slot premium · Em breve",
    category: "slots",
    playable: false,
    featured: false,
    accent: "panda",
    emblem: "🐼",
    volatility: "Média",
  },
  {
    slug: "classic-seven",
    name: "Classic Seven",
    tagline: "Slot clássico · Em breve",
    category: "slots",
    playable: false,
    featured: false,
    accent: "classic",
    emblem: "7️⃣",
    volatility: "Baixa",
  },
  {
    slug: "pirate-coins",
    name: "Pirate Coins",
    tagline: "Slot de aventura · Em breve",
    category: "slots",
    playable: false,
    featured: false,
    accent: "pirate",
    emblem: "🏴‍☠️",
    volatility: "Alta",
  },
  {
    slug: "neon-rocket",
    name: "Neon Rocket",
    tagline: "Arcade · Em breve",
    category: "arcade",
    playable: false,
    featured: false,
    accent: "rocket",
    emblem: "🚀",
    volatility: "Alta",
  },
  {
    slug: "fortune-wheel",
    name: "Fortune Wheel",
    tagline: "Mesa · Em breve",
    category: "mesa",
    playable: false,
    featured: false,
    accent: "wheel",
    emblem: "🎡",
    volatility: "Média",
  },
  {
    slug: "royal-dice",
    name: "Royal Dice",
    tagline: "Mesa · Em breve",
    category: "mesa",
    playable: false,
    featured: false,
    accent: "dice",
    emblem: "🎲",
    volatility: "Média",
  },
  {
    slug: "royal-cards",
    name: "Royal Cards",
    tagline: "Mesa · Em breve",
    category: "mesa",
    playable: false,
    featured: false,
    accent: "royal",
    emblem: "♠️",
    volatility: "Baixa",
  },
  {
    slug: "lucky-rabbit",
    name: "Lucky Rabbit",
    tagline: "Slot premium · Em breve",
    category: "slots",
    playable: false,
    featured: false,
    accent: "rabbit",
    emblem: "🐇",
    volatility: "Média",
  },
] as const;

export const PLAYABLE_GAMES = GAMES.filter((game) => game.playable);
export const FEATURED_GAMES = GAMES.filter((game) => game.featured);

export function findGame(slug: string) {
  return GAMES.find((game) => game.slug === slug);
}
