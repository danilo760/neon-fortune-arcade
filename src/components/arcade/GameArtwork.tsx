import {
  Anchor,
  Bomb,
  Candy,
  CircleDot,
  Crown,
  Dices,
  Flame,
  Gem,
  Leaf,
  Rocket,
  RotateCw,
  Sparkles,
  Spade,
  Star,
  Zap,
} from "lucide-react";

import type { GameEntry } from "@/lib/arcade/catalog";
import { cn } from "@/lib/utils";

export function TigerCubMascot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 260 220"
      className={cn("tiger-cub", className)}
      role="img"
      aria-label="Tigre filhote dourado"
    >
      <defs>
        <linearGradient id="tigerFur" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd55a" />
          <stop offset="0.45" stopColor="#ff9f1c" />
          <stop offset="1" stopColor="#d85b13" />
        </linearGradient>
        <linearGradient id="tigerGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset="0.5" stopColor="#f8c33d" />
          <stop offset="1" stopColor="#a95a08" />
        </linearGradient>
        <filter id="tigerGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <ellipse cx="130" cy="198" rx="82" ry="17" fill="#000" opacity=".32" />
      <circle cx="55" cy="61" r="34" fill="url(#tigerFur)" stroke="#7d300b" strokeWidth="8" />
      <circle cx="205" cy="61" r="34" fill="url(#tigerFur)" stroke="#7d300b" strokeWidth="8" />
      <circle cx="55" cy="61" r="16" fill="#ffd6b1" opacity=".9" />
      <circle cx="205" cy="61" r="16" fill="#ffd6b1" opacity=".9" />
      <path
        d="M40 101C48 47 84 24 130 24s82 23 90 77c8 55-27 99-90 99s-98-44-90-99Z"
        fill="url(#tigerFur)"
        stroke="#7d300b"
        strokeWidth="8"
      />
      <path d="M130 31l-18 29 18-8 18 8-18-29Z" fill="#3d1c12" />
      <path d="M86 48l14 30-24-16 10-14Zm88 0-14 30 24-16-10-14Z" fill="#3d1c12" />
      <path d="M73 90l31 7-27 14-4-21Zm114 0-31 7 27 14 4-21Z" fill="#3d1c12" />
      <ellipse cx="93" cy="110" rx="25" ry="30" fill="#fff7df" />
      <ellipse cx="167" cy="110" rx="25" ry="30" fill="#fff7df" />
      <ellipse cx="93" cy="112" rx="12" ry="16" fill="#2a160d" />
      <ellipse cx="167" cy="112" rx="12" ry="16" fill="#2a160d" />
      <circle cx="98" cy="105" r="4" fill="#fff" />
      <circle cx="172" cy="105" r="4" fill="#fff" />
      <ellipse cx="130" cy="151" rx="49" ry="35" fill="#fff0d6" />
      <path d="M116 143c8-9 20-9 28 0-3 9-9 14-14 14s-11-5-14-14Z" fill="#7a2d26" />
      <path d="M103 160c17 22 37 22 54 0" fill="none" stroke="#7a2d26" strokeWidth="6" strokeLinecap="round" />
      <path d="M87 147H53m35 10-38 8m123-18h34m-35 10 38 8" stroke="#5b2a17" strokeWidth="4" strokeLinecap="round" opacity=".75" />
      <path d="M83 22h94l-9 23H92L83 22Z" fill="#b81f1f" stroke="#7a120f" strokeWidth="5" />
      <path d="M111 14h38l14 26H97l14-26Z" fill="url(#tigerGold)" stroke="#8b4f00" strokeWidth="4" />
      <circle cx="130" cy="30" r="8" fill="#17b978" stroke="#ffe37a" strokeWidth="4" filter="url(#tigerGlow)" />
      <path d="M82 181c10-8 24-11 37-7l-8 20H83l-1-13Zm96 0c-10-8-24-11-37-7l8 20h28l1-13Z" fill="#fff0d6" stroke="#7d300b" strokeWidth="5" />
    </svg>
  );
}

function IconCluster({ game }: { game: GameEntry }) {
  const common = "size-9 sm:size-12";
  switch (game.slug) {
    case "golden-tiger":
      return (
        <>
          <TigerCubMascot className="absolute -bottom-8 left-1/2 w-[62%] -translate-x-1/2 drop-shadow-[0_18px_30px_rgba(0,0,0,.55)]" />
          <Gem className={cn(common, "absolute right-[12%] top-[22%] text-emerald-300")} />
          <Sparkles className="absolute left-[13%] top-[17%] size-8 text-amber-200" />
        </>
      );
    case "olympus-storm":
      return (
        <>
          <Crown className={cn(common, "absolute left-[14%] top-[22%] text-amber-300")} />
          <Zap className="absolute left-1/2 top-[18%] size-20 -translate-x-1/2 text-sky-200 drop-shadow-[0_0_22px_rgba(56,189,248,.9)]" />
          <Gem className={cn(common, "absolute right-[13%] top-[50%] text-blue-300")} />
        </>
      );
    case "candy-cascade":
      return (
        <>
          <Candy className="absolute left-[12%] top-[24%] size-14 rotate-[-18deg] text-pink-200" />
          <Star className="absolute left-1/2 top-[16%] size-16 -translate-x-1/2 text-yellow-200" />
          <CircleDot className="absolute right-[13%] top-[44%] size-14 text-cyan-200" />
        </>
      );
    case "neon-mines":
      return (
        <>
          <Gem className="absolute left-[18%] top-[20%] size-20 text-emerald-300 drop-shadow-[0_0_24px_rgba(52,211,153,.8)]" />
          <Bomb className="absolute right-[16%] top-[35%] size-20 text-rose-400 drop-shadow-[0_0_24px_rgba(251,113,133,.7)]" />
        </>
      );
    case "neon-plinko":
      return (
        <>
          <div className="absolute inset-x-[18%] top-[16%] grid grid-cols-7 gap-2 opacity-90">
            {Array.from({ length: 21 }, (_, index) => (
              <span key={index} className="aspect-square rounded-full bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,.8)]" />
            ))}
          </div>
          <CircleDot className="absolute left-1/2 top-[23%] size-11 -translate-x-1/2 text-fuchsia-300 drop-shadow-[0_0_16px_rgba(232,121,249,.95)]" />
        </>
      );
    case "dragon-fortune":
      return <Flame className="size-24 text-orange-300 drop-shadow-[0_0_24px_rgba(251,146,60,.75)]" />;
    case "lucky-ox":
      return <Crown className="size-24 text-yellow-200" />;
    case "panda-gold":
      return <Leaf className="size-24 text-emerald-200" />;
    case "classic-777":
      return <Star className="size-24 text-red-200" />;
    case "pirate-treasure":
      return <Anchor className="size-24 text-cyan-200" />;
    case "rocket-crash":
      return <Rocket className="size-24 rotate-[-22deg] text-sky-200" />;
    case "fortune-wheel":
      return <RotateCw className="size-24 text-fuchsia-200" />;
    case "neon-dice":
      return <Dices className="size-24 text-cyan-200" />;
    case "royal-blackjack":
      return <Spade className="size-24 text-violet-200" />;
    default:
      return <Sparkles className="size-24 text-lime-200" />;
  }
}

export function GameArtwork({ game, compact = false }: { game: GameEntry; compact?: boolean }) {
  return (
    <div className={cn("game-artwork", `game-artwork--${game.accent}`, compact && "game-artwork--compact")}>
      <div className="game-artwork__stars" aria-hidden />
      <div className="game-artwork__halo" aria-hidden />
      <div className="game-artwork__icons" aria-hidden>
        <IconCluster game={game} />
      </div>
      <div className="game-artwork__title">
        <span>{game.name}</span>
        <small>{game.playable ? "PRIVATE ARCADE" : "COMING SOON"}</small>
      </div>
    </div>
  );
}
