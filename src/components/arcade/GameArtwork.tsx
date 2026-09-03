import {
  Anchor,
  Bomb,
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
} from "lucide-react";

import candyReference from "@/assets/candy-cascade/reference-hd.webp";
import { goldenTigerReferenceBase64 } from "@/assets/golden-tiger/referenceData";
import { olympusStormReferenceBase64 } from "@/assets/olympus-storm/referenceData";
import type { GameEntry } from "@/lib/arcade/catalog";
import { cn } from "@/lib/utils";

import "./GameArtworkPremium.css";

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

const goldenTigerReference = `data:image/webp;base64,${goldenTigerReferenceBase64}`;
const olympusReference = `data:image/webp;base64,${olympusStormReferenceBase64}`;

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
      return <ReferenceCover src={goldenTigerReference} className="game-cover-reference--tiger" />;
    case "olympus-storm":
      return <ReferenceCover src={olympusReference} className="game-cover-reference--olympus" />;
    case "candy-cascade":
      return <ReferenceCover src={candyReference} className="game-cover-reference--candy" />;
    case "neon-mines":
      return (
        <div className="game-cover-premium game-cover-premium--mines">
          <div className="game-cover-mines__header"><Gem /><span>CRYSTAL VAULT</span></div>
          <div className="game-cover-mines__grid" aria-hidden>
            {Array.from({ length: 15 }, (_, index) => (
              <span key={index} className={cn("game-cover-mines__tile", index === 12 && "is-danger", index === 7 && "is-gem")}>
                {index === 12 ? <Bomb /> : index === 7 ? <Gem /> : <i />}
              </span>
            ))}
          </div>
          <div className="game-cover-mines__rail" aria-hidden />
        </div>
      );
    case "neon-plinko":
      return (
        <div className="game-cover-premium game-cover-premium--plinko">
          <div className="game-cover-plinko__portal" aria-hidden><span /></div>
          <div className="game-cover-plinko__pegs" aria-hidden>
            {Array.from({ length: 28 }, (_, index) => <span key={index} />)}
          </div>
          <div className="game-cover-plinko__ball" aria-hidden />
          <div className="game-cover-plinko__slots" aria-hidden>
            {[14, 3, 0.6, 0.3, 2, 14].map((value, index) => <span key={`${value}-${index}`}>{value}×</span>)}
          </div>
        </div>
      );
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
