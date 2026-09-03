import { Link } from "@tanstack/react-router";
import { Heart, Lock, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ACCENT_GRADIENTS, CATEGORY_LABELS, type GameEntry } from "@/lib/arcade/catalog";
import { arcadeActions, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

export function GameCard({ game }: { game: GameEntry }) {
  const isFavorite = useArcade((state) => state.favorites.includes(game.slug));

  const art = (
    <div
      className="relative flex aspect-[4/3] items-center justify-center overflow-hidden"
      style={{ background: ACCENT_GRADIENTS[game.accent] }}
    >
      <span className="text-5xl drop-shadow-[0_6px_18px_rgba(0,0,0,0.5)] sm:text-6xl" aria-hidden>
        {game.emblem}
      </span>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_120%,oklch(0_0_0/0.55),transparent_60%)]" />
      {game.playable ? (
        <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-widest text-primary">
          Jogável
        </span>
      ) : (
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-ink/85 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground">
          <Lock className="size-3" aria-hidden /> Em breve
        </span>
      )}
      <span className="absolute bottom-2 left-2 rounded-full bg-ink/70 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-foreground/80">
        {CATEGORY_LABELS[game.category]}
      </span>
    </div>
  );

  return (
    <article className="group relative overflow-hidden rounded-2xl surface-panel transition-transform duration-300 hover:-translate-y-1">
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

      <div className="flex flex-col gap-2 p-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-bold text-foreground">
              {game.name}
            </h3>
            <p className="line-clamp-2 text-xs text-muted-foreground">{game.tagline}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="size-9 shrink-0 rounded-full"
            aria-label={
              isFavorite ? `Remover ${game.name} dos favoritos` : `Favoritar ${game.name}`
            }
            aria-pressed={isFavorite}
            onClick={() => arcadeActions.toggleFavorite(game.slug)}
          >
            <Heart
              className={cn(
                "size-4",
                isFavorite ? "fill-accent text-accent" : "text-muted-foreground",
              )}
              aria-hidden
            />
          </Button>
        </div>

        {game.playable ? (
          <Button asChild variant="gold" className="w-full">
            <Link to="/game/$slug" params={{ slug: game.slug }}>
              <Play className="size-4" aria-hidden />
              Jogar agora
            </Link>
          </Button>
        ) : (
          <Button variant="outline" className="w-full" disabled>
            Em breve
          </Button>
        )}
      </div>
    </article>
  );
}
