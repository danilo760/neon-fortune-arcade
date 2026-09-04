import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import polishCss from "../../arcade-polish.css?url";
import hudFixesCss from "../../arcade-hud-fixes.css?url";
import motionPolishCss from "../../arcade-motion-polish.css?url";
import { GameShell } from "@/components/arcade/GameShell";
import { getGame } from "@/lib/arcade/catalog";
import { SLOT_CONFIGS } from "@/lib/arcade/slot-configs";

const GoldenTigerReference = lazy(async () => {
  const module = await import("@/components/arcade/GoldenTigerReference");
  return { default: module.GoldenTigerReference };
});

const OlympusStormReference = lazy(async () => {
  const module = await import("@/components/arcade/OlympusStormReference");
  return { default: module.OlympusStormReference };
});

const CandyCascadeReference = lazy(async () => {
  const module = await import("@/components/arcade/CandyCascadeReference");
  return { default: module.CandyCascadeReference };
});

const MinesGame = lazy(async () => {
  const module = await import("@/components/arcade/MinesGame");
  return { default: module.MinesGame };
});

const PlinkoReference = lazy(async () => {
  const module = await import("@/components/arcade/PlinkoReference");
  return { default: module.PlinkoReference };
});

const SlotGame = lazy(async () => {
  const module = await import("@/components/arcade/SlotGame");
  return { default: module.SlotGame };
});

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
    links: [
      { rel: "stylesheet", href: polishCss },
      { rel: "stylesheet", href: hudFixesCss },
      { rel: "stylesheet", href: motionPolishCss },
    ],
  }),
  component: GameRoute,
});

function GameLoading({ name }: { name: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-black px-4 text-center text-white">
      <p className="text-sm font-black uppercase tracking-[.18em] text-white/70">Carregando {name}…</p>
    </main>
  );
}

function GameRoute() {
  const { game } = Route.useLoaderData();

  let content;

  if (game.slug === "golden-tiger") {
    content = <GoldenTigerReference />;
  } else if (game.slug === "olympus-storm") {
    content = <OlympusStormReference />;
  } else if (game.slug === "candy-cascade") {
    content = <CandyCascadeReference />;
  } else if (game.slug === "neon-plinko") {
    content = <PlinkoReference />;
  } else {
    const slotConfig = SLOT_CONFIGS[game.slug];
    content = (
      <GameShell game={game}>
        {slotConfig ? <SlotGame config={slotConfig} /> : <MinesGame />}
      </GameShell>
    );
  }

  return <Suspense fallback={<GameLoading name={game.name} />}>{content}</Suspense>;
}
