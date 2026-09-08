import {
  Anchor,
  Crown,
  Dices,
  Flame,
  Leaf,
  Rocket,
  RotateCw,
  Sparkles,
  Spade,
  Star,
} from "lucide-react";

import candyReference from "@/assets/candy-cascade/reference.webp";
import goldenTigerHero from "@/assets/golden-tiger/golden-tiger-mascot.webp";
import neonMinesReference from "@/assets/neon-mines-reference.webp";
import neonPlinkoReference from "@/assets/neon-plinko-reference.webp";
import olympusReference from "@/assets/olympus-storm/reference.webp";
import type { GameEntry } from "@/lib/arcade/catalog";
import { cn } from "@/lib/utils";

import "./GameArtworkPremium.css";

export function TigerCubMascot({ className }: { className?: string }) {
  return (
    <img
      src={goldenTigerHero}
      className={cn("tiger-cub", className)}
      alt="Tigre dourado"
      draggable={false}
    />
  );
}

function ReferenceCover({ src, className }: { src: string; className: string }) {
  return (
    <div className={cn("game-cover-reference", className)}>
      <img src={src} alt="" className="game-cover-reference__blur" aria-hidden />
      <img src={src} alt="" className="game-cover-reference__main" aria-hidden />
      <div className="game-cover-reference__shine" aria-hidden />
    </div>
  );
}

function PlayableCover({ game }: { game: GameEntry }) {
  switch (game.slug) {
    case "golden-tiger":
      return <ReferenceCover src={goldenTigerHero} className="game-cover-reference--tiger" />;
    case "olympus-storm":
      return <ReferenceCover src={olympusReference} className="game-cover-reference--olympus" />;
    case "candy-cascade":
      return <ReferenceCover src={candyReference} className="game-cover-reference--candy" />;
    case "neon-mines":
      return <ReferenceCover src={neonMinesReference} className="game-cover-reference--mines" />;
    case "neon-plinko":
      return <ReferenceCover src={neonPlinkoReference} className="game-cover-reference--plinko" />;
    default:
      return null;
  }
}

function ComingSoonIcon({ game }: { game: GameEntry }) {
  switch (game.slug) {
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
  const playableCover = game.playable ? <PlayableCover game={game} /> : null;

  return (
    <div className={cn("game-artwork", `game-artwork--${game.accent}`, compact && "game-artwork--compact", game.playable && "game-artwork--premium-cover")}>
      {playableCover ?? (
        <>
          <div className="game-artwork__stars" aria-hidden />
          <div className="game-artwork__halo" aria-hidden />
          <div className="game-artwork__icons" aria-hidden><ComingSoonIcon game={game} /></div>
        </>
      )}
      <div className="game-artwork__title">
        <span>{game.name}</span>
        <small>{game.playable ? "PRIVATE ARCADE" : "COMING SOON"}</small>
      </div>
    </div>
  );
}
