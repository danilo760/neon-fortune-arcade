import { createFileRoute } from "@tanstack/react-router";

import { GameShell } from "@/components/arcade/GameShell";
import { MinesGame } from "@/components/arcade/MinesGame";
import { getGame } from "@/lib/arcade/catalog";

export const Route = createFileRoute("/")({ component: MinesCapture });

function MinesCapture() {
  const game = getGame("neon-mines");
  if (!game) return null;

  return (
    <GameShell game={game}>
      <MinesGame />
    </GameShell>
  );
}
