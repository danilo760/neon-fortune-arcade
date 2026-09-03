import { createFileRoute } from "@tanstack/react-router";

import { GameShell } from "@/components/arcade/GameShell";
import { PlinkoGame } from "@/components/arcade/PlinkoGame";
import { GAMES } from "@/lib/arcade/catalog";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const game = GAMES.find((item) => item.slug === "neon-plinko") ?? GAMES[4];
  if (!game) return null;
  return <GameShell game={game}><PlinkoGame /></GameShell>;
}
