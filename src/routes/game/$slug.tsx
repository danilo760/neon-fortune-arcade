import { createFileRoute, notFound } from "@tanstack/react-router";

import "@/components/arcade/GoldenTigerGame.css";
import "@/components/arcade/GoldenTigerReels.css";
import { GameShell } from "@/components/arcade/GameShell";
import { GoldenTigerCabinetV2 } from "@/components/arcade/GoldenTigerCabinetV2";
import { MinesGame } from "@/components/arcade/MinesGame";
import { PlinkoGame } from "@/components/arcade/PlinkoGame";
import { SlotGame } from "@/components/arcade/SlotGame";
import { getGame } from "@/lib/arcade/catalog";
import { SLOT_CONFIGS } from "@/lib/arcade/slot-configs";

export const Route = createFileRoute("/game/$slug")({
  loader: ({ params }) => {
    const game = getGame(params.slug);
    if (!game?.playable) throw notFound();
    return { game };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.game.name ?? "Jogo"} | Lucky Neon Arcade` },
      {
        name: "description",
        content: loaderData?.game.tagline ?? "Arcade privado com moedas fictícias",
      },
    ],
  }),
  component: GameRoute,
});

function GameRoute() {
  const { game } = Route.useLoaderData();

  if (game.slug === "golden-tiger") {
    return <GoldenTigerCabinetV2 />;
  }

  const slotConfig = SLOT_CONFIGS[game.slug];

  return (
    <GameShell game={game}>
      {slotConfig ? (
        <SlotGame config={slotConfig} />
      ) : game.slug === "neon-mines" ? (
        <MinesGame />
      ) : (
        <PlinkoGame />
      )}
    </GameShell>
  );
}
