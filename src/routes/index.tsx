import { createFileRoute } from "@tanstack/react-router";

import { GameShell } from "@/components/arcade/GameShell";
import { PlinkoGame } from "@/components/arcade/PlinkoGame";
import { getGame } from "@/lib/arcade/catalog";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const game = getGame("neon-plinko");
  if (!game) return null;

  return (
    <GameShell game={game}>
      <PlinkoGame />
    </GameShell>
  );
}
