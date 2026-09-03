import { Link } from "@tanstack/react-router";
import { ArrowLeft, Gamepad2, ShieldCheck } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { GameEntry } from "@/lib/arcade/catalog";
import { hydrateFromStorage } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import { BalanceDisplay } from "./BalanceDisplay";
import { FictionalNotice } from "./FictionalNotice";
import { SoundToggle } from "./SoundToggle";

export function GameShell({ game, children }: { game: GameEntry; children: ReactNode }) {
  useEffect(() => hydrateFromStorage(), []);

  return (
    <div className={cn("game-page min-h-screen pb-8", `game-page--${game.accent}`)} data-game={game.slug}>
      <div className="game-page__ambient" aria-hidden />
      <header className="game-topbar sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:px-6">
          <Button asChild size="icon" variant="ghost" className="size-10 shrink-0 rounded-full border border-white/10 bg-black/25 hover:bg-white/10">
            <Link to="/" aria-label="Voltar ao lobby"><ArrowLeft className="size-5" aria-hidden /></Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[0.58rem] font-bold uppercase tracking-[0.25em] text-white/45"><Gamepad2 className="size-3" aria-hidden /> Neon Fortune Arcade</p>
            <h1 className="truncate font-display text-base font-black text-gold-gradient sm:text-xl">{game.name}</h1>
          </div>
          <span className="hidden items-center gap-1 rounded-full border border-emerald-300/15 bg-black/25 px-2.5 py-1 text-[0.58rem] font-bold uppercase tracking-wider text-emerald-200/75 sm:flex"><ShieldCheck className="size-3" /> Fictício</span>
          <SoundToggle />
          <BalanceDisplay compact className="max-w-[12rem]" />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-2.5 py-3 sm:px-6 sm:py-6">
        <FictionalNotice className="mx-auto mb-3 max-w-md opacity-80" />
        {children}
      </main>
    </div>
  );
}
