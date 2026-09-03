export type GameCategory = "slots" | "arcade" | "mesa";

export interface GameEntry {
  slug: string;
  name: string;
  tagline: string;
  category: GameCategory;
  playable: boolean;
  featured: boolean;
  /** Visual identity: gradient stops as oklch token expressions. */
  accent: "gold" | "storm" | "candy" | "mine" | "plinko" | "dragon" | "ox" | "panda" | "classic" | "pirate" | "rocket" | "wheel" | "dice" | "royal" | "rabbit";
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
    tagline: "Slot 3x3 · Wild, Free Spins e multiplicadores",
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
    tagline: "Arcade · Bola de neon, pinos e multiplicadores",
    category: "arcade",
    playable: true,
    featured: true,
    accent: "plinko",
    emblem: "🔮",
    volatility: "Ajustável",
  },
  {
    slug: "dragon-fortune",
    name: "Dragon Fortune",
    tagline: "Slot de escamas flamejantes",
    category: "slots",
    playable: false,
    featured: false,
    accent: "dragon",
    emblem: "🐉",
    volatility: "Alta",
  },
  {
    slug: "lucky-ox",
    name: "Lucky Ox",
    tagline: "Slot rural de sorte dourada",
    category: "slots",
    playable: false,
    featured: false,
    accent: "ox",
    emblem: "🐂",
    volatility: "Média",
  },
  {
    slug: "panda-gold",
    name: "Panda Gold",
    tagline: "Slot de bambu e ouro",
    category: "slots",
    playable: false,
    featured: false,
    accent: "panda",
    emblem: "🐼",
    volatility: "Baixa",
  },
  {
    slug: "classic-777",
    name: "Classic 777",
    tagline: "Slot clássico de três rolos",
    category: "slots",
    playable: false,
    featured: false,
    accent: "classic",
    emblem: "7️⃣",
    volatility: "Baixa",
  },
  {
    slug: "pirate-treasure",
    name: "Pirate Treasure",
    tagline: "Slot de aventura em alto-mar",
    category: "slots",
    playable: false,
    featured: false,
    accent: "pirate",
    emblem: "🏴",
    volatility: "Alta",
  },
  {
    slug: "rocket-crash",
    name: "Rocket Crash",
    tagline: "Crash fictício de curva ascendente",
    category: "arcade",
    playable: false,
    featured: false,
    accent: "rocket",
    emblem: "🚀",
    volatility: "Extrema",
  },
  {
    slug: "fortune-wheel",
    name: "Fortune Wheel",
    tagline: "Roda da fortuna com setores neon",
    category: "arcade",
    playable: false,
    featured: false,
    accent: "wheel",
    emblem: "🎡",
    volatility: "Média",
  },
  {
    slug: "neon-dice",
    name: "Neon Dice",
    tagline: "Dados de vidro com faixas de sorte",
    category: "mesa",
    playable: false,
    featured: false,
    accent: "dice",
    emblem: "🎲",
    volatility: "Ajustável",
  },
  {
    slug: "royal-blackjack",
    name: "Royal Blackjack",
    tagline: "Blackjack simplificado de mesa única",
    category: "mesa",
    playable: false,
    featured: false,
    accent: "royal",
    emblem: "🂡",
    volatility: "Baixa",
  },
  {
    slug: "lucky-rabbit",
    name: "Lucky Rabbit",
    tagline: "Slot lunar de trevos e lanternas",
    category: "slots",
    playable: false,
    featured: false,
    accent: "rabbit",
    emblem: "🐇",
    volatility: "Média",
  },
];

export const ACCENT_GRADIENTS: Record<GameEntry["accent"], string> = {
  gold: "linear-gradient(150deg, oklch(0.5 0.16 62), oklch(0.28 0.09 40))",
  storm: "linear-gradient(150deg, oklch(0.46 0.17 280), oklch(0.24 0.09 290))",
  candy: "linear-gradient(150deg, oklch(0.55 0.2 340), oklch(0.3 0.11 320))",
  mine: "linear-gradient(150deg, oklch(0.48 0.15 190), oklch(0.24 0.08 250))",
  plinko: "linear-gradient(150deg, oklch(0.5 0.19 305), oklch(0.25 0.09 300))",
  dragon: "linear-gradient(150deg, oklch(0.48 0.2 28), oklch(0.24 0.09 20))",
  ox: "linear-gradient(150deg, oklch(0.47 0.13 80), oklch(0.25 0.07 60))",
  panda: "linear-gradient(150deg, oklch(0.45 0.11 160), oklch(0.24 0.06 170))",
  classic: "linear-gradient(150deg, oklch(0.48 0.18 15), oklch(0.26 0.08 350))",
  pirate: "linear-gradient(150deg, oklch(0.42 0.1 230), oklch(0.22 0.06 250))",
  rocket: "linear-gradient(150deg, oklch(0.5 0.2 250), oklch(0.24 0.09 280))",
  wheel: "linear-gradient(150deg, oklch(0.52 0.18 350), oklch(0.26 0.09 300))",
  dice: "linear-gradient(150deg, oklch(0.46 0.15 200), oklch(0.24 0.07 240))",
  royal: "linear-gradient(150deg, oklch(0.44 0.14 300), oklch(0.22 0.07 300))",
  rabbit: "linear-gradient(150deg, oklch(0.5 0.14 130), oklch(0.25 0.07 150))",
};

export function getGame(slug: string): GameEntry | undefined {
  return GAMES.find((game) => game.slug === slug);
}

export const PLAYABLE_SLUGS = GAMES.filter((g) => g.playable).map((g) => g.slug);
