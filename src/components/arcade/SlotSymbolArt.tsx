import {
  Bell,
  Candy,
  CircleDot,
  Coins,
  Crown,
  Gem,
  Hammer,
  Landmark,
  Leaf,
  Moon,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ICONS = {
  coin: Coins,
  jade: Gem,
  bell: Bell,
  lantern: Sparkles,
  bamboo: Leaf,
  wild: Star,
  bonus: Moon,
  crown: Crown,
  bolt: Zap,
  helm: Landmark,
  chalice: Trophy,
  ring: CircleDot,
  hourglass: Gem,
  "star-drop": Star,
  "cherry-gel": Candy,
  "melon-cube": Gem,
  "grape-bead": CircleDot,
  "lemon-chew": Sparkles,
  "mint-swirl": Candy,
} as const;

function TigerMark() {
  return (
    <svg viewBox="0 0 90 90" className="size-[72%]" aria-hidden>
      <defs>
        <linearGradient id="miniTiger" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd967" />
          <stop offset="1" stopColor="#ef7c12" />
        </linearGradient>
      </defs>
      <circle cx="45" cy="47" r="31" fill="url(#miniTiger)" stroke="#7a2b08" strokeWidth="5" />
      <circle cx="22" cy="25" r="13" fill="#ef8b19" stroke="#7a2b08" strokeWidth="5" />
      <circle cx="68" cy="25" r="13" fill="#ef8b19" stroke="#7a2b08" strokeWidth="5" />
      <path d="M45 18 35 34l10-5 10 5-10-16ZM27 39l14 4-12 7-2-11Zm36 0-14 4 12 7 2-11Z" fill="#442013" />
      <ellipse cx="34" cy="49" rx="7" ry="9" fill="#20100c" />
      <ellipse cx="56" cy="49" rx="7" ry="9" fill="#20100c" />
      <circle cx="36" cy="46" r="2.4" fill="#fff" />
      <circle cx="58" cy="46" r="2.4" fill="#fff" />
      <ellipse cx="45" cy="65" rx="18" ry="13" fill="#fff0d5" />
      <path d="M40 60c3-4 7-4 10 0-1 4-3 6-5 6s-4-2-5-6Z" fill="#79302a" />
    </svg>
  );
}

export function SlotSymbolArt({ game, symbolId }: { game: string; symbolId: string }) {
  const Icon = ICONS[symbolId as keyof typeof ICONS];
  const isTiger = game === "golden-tiger" && symbolId === "tiger";
  const theme = game === "golden-tiger" ? "tiger" : game === "olympus-storm" ? "storm" : "candy";

  return (
    <span className={cn("slot-symbol-art", `slot-symbol-art--${theme}`, `slot-symbol-art--${symbolId}`)} aria-hidden>
      {isTiger ? <TigerMark /> : Icon ? <Icon className="size-[62%]" strokeWidth={1.7} /> : <Gem className="size-[62%]" />}
    </span>
  );
}
