import { Link } from "@tanstack/react-router";
import { Heart, Lock, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, type GameEntry } from "@/lib/arcade/catalog";
import { arcadeActions, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import { GameArtwork } from "./GameArtwork";

export function GameCard({ game }: { game: GameEntry }) {
  const isFavorite = useArcade((state) => state.favorites.includes(game.slug));

  const art = (
    <div className="relative aspect-[4/3] overflow-hidden">
      <GameArtwork game={game} compact />
      {game.playable ? (
        <span className="game-card__badge game-card__badge--live">Jogável</span>
      ) : (
        <span className="game-card__badge game-card__badge--soon">
          <Lock className="size-3" aria-hidden /> Em breve
        </span>
      )}
      <span className="game-card__category">{CATEGORY_LABELS[game.category]}</span>
    </div>
  );

  return (
    <article className={cn("game-card group", game.playable ? "game-card--playable" : "game-card--soon")}>
      {game.playable ? (
        <Link
          to="/game/$slug"
          params={{ slug: game.slug }}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Jogar ${game.name}`}
        >
          {art}
        </Link>
      ) : (
        art
      )}

      <div className="game-card__body">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-black text-white sm:text-lg">{game.name}</h3>
            <p className="line-clamp-2 text-xs text-white/55">{game.tagline}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="size-9 shrink-0 rounded-full border border-white/10 bg-black/20 hover:bg-white/10"
            aria-label={isFavorite ? `Remover ${game.name} dos favoritos` : `Favoritar ${game.name}`}
            aria-pressed={isFavorite}
            onClick={() => arcadeActions.toggleFavorite(game.slug)}
          >
            <Heart
              className={cn("size-4", isFavorite ? "fill-rose-400 text-rose-300" : "text-white/55")}
              aria-hidden
            />
          </Button>
        </div>

        {game.playable ? (
          <Button asChild variant="gold" className="game-card__play w-full rounded-xl font-black">
            <Link to="/game/$slug" params={{ slug: game.slug }}>
              <Play className="size-4" aria-hidden /> Jogar agora
            </Link>
          </Button>
        ) : (
          <Button variant="outline" className="w-full rounded-xl border-white/10 bg-black/20" disabled>
            Em breve
          </Button>
        )}
      </div>
    </article>
  );
}
