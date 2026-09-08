import {
  Anchor,
  Bomb,
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

import goldenTigerHero from "@/assets/golden-tiger/golden-tiger-mascot.webp";
import type { GameEntry } from "@/lib/arcade/catalog";
import { cn } from "@/lib/utils";

import "./GameArtworkPremium.css";
import "./GameArtworkOriginal.css";

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

function TigerCover() {
  return (
    <div className="game-cover-reference game-cover-reference--tiger">
      <img src={goldenTigerHero} alt="" className="game-cover-reference__blur" aria-hidden />
      <img src={goldenTigerHero} alt="" className="game-cover-reference__main" aria-hidden />
      <div className="game-cover-reference__shine" aria-hidden />
    </div>
  );
}

function OriginalCover({ game }: { game: GameEntry }) {
  let icon = <Sparkles />;
  let className = "game-cover-original--candy";

  switch (game.slug) {
    case "olympus-storm":
      icon = <Zap />;
      className = "game-cover-original--olympus";
      break;
    case "candy-cascade":
      icon = <Sparkles />;
      className = "game-cover-original--candy";
      break;
    case "neon-mines":
      icon = <Gem />;
      className = "game-cover-original--mines";
      break;
    case "neon-plinko":
      icon = <CircleDot />;
      className = "game-cover-original--plinko";
      break;
    default:
      break;
  }

  return (
    <div className={cn("game-cover-original", className)}>
      <div className="game-cover-original__spark" aria-hidden />
      <div className="game-cover-original__icon" aria-hidden>{icon}</div>
    </div>
  );
}

function PlayableCover({ game }: { game: GameEntry }) {
  if (game.slug === "golden-tiger") return <TigerCover />;
  return <OriginalCover game={game} />;
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
    case "danger-vault":
      return <Bomb className="size-24 text-rose-200" />;
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
