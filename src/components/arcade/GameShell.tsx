import { Link } from "@tanstack/react-router";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { GameEntry } from "@/lib/arcade/catalog";
import { hydrateFromStorage } from "@/lib/arcade/store";

import { BalanceDisplay } from "./BalanceDisplay";
import { FictionalNotice } from "./FictionalNotice";
import { SoundToggle } from "./SoundToggle";

export function GameShell({ game, children }: { game: GameEntry; children: ReactNode }) {
  useEffect(() => hydrateFromStorage(), []);

  return (
    <div className="min-h-screen pb-8">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3 sm:px-6">
          <Button asChild size="icon" variant="ghost" className="size-11 shrink-0 rounded-full">
            <Link to="/" aria-label="Voltar ao lobby">
              <ArrowLeft className="size-5" aria-hidden />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-primary/75">
              <Gamepad2 className="size-3" aria-hidden /> Lucky Neon Arcade
            </p>
            <h1 className="truncate font-display text-base font-black text-gold-gradient sm:text-xl">
              {game.name}
            </h1>
          </div>
          <SoundToggle />
          <BalanceDisplay compact className="max-w-[12rem]" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-7">
        <FictionalNotice className="mx-auto mb-4 max-w-md" />
        {children}
      </main>
    </div>
  );
}
