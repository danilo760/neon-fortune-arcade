import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import goldenTigerPresentationCss from "../../components/arcade/GoldenTigerPresentationSafe.css?url";
import olympusStormPresentationCss from "../../components/arcade/OlympusStormPremiumPolish.css?url";
import candyCascadePresentationCss from "../../components/arcade/CandyCascadePremium.css?url";
import minesPresentationCss from "../../components/arcade/MinesPresentationSafe.css?url";
import plinkoPresentationCss from "../../components/arcade/PlinkoPresentationSafe.css?url";
import { GameShell } from "@/components/arcade/GameShell";
import { getGame } from "@/lib/arcade/catalog";

const PRESENTATION_CSS: Partial<Record<string, string>> = {
  "golden-tiger": goldenTigerPresentationCss,
  "olympus-storm": olympusStormPresentationCss,
  "candy-cascade": candyCascadePresentationCss,
  "neon-mines": minesPresentationCss,
  "neon-plinko": plinkoPresentationCss,
};

const GoldenTigerReference = lazy(async () => {
  const module = await import("@/components/arcade/GoldenTigerReference");
  return { default: module.GoldenTigerReference };
});

const OlympusStormPremium = lazy(async () => {
  const module = await import("@/components/arcade/OlympusStormPremium");
  return { default: module.OlympusStormPremium };
});

const CandyCascadePremium = lazy(async () => {
  const module = await import("@/components/arcade/CandyCascadePremium");
  return { default: module.CandyCascadePremium };
});

const MinesGame = lazy(async () => {
  const module = await import("@/components/arcade/MinesGame");
  return { default: module.MinesGame };
});

const PlinkoReference = lazy(async () => {
  const module = await import("@/components/arcade/PlinkoReference");
  return { default: module.PlinkoReference };
});

export const Route = createFileRoute("/game/$slug")({
  loader: ({ params }) => {
    const game = getGame(params.slug);
    if (!game?.playable) throw notFound();
    return { game };
  },
  head: ({ loaderData }) => {
    const presentationCss = loaderData?.game ? PRESENTATION_CSS[loaderData.game.slug] : undefined;
    return {
      meta: [
        { title: `${loaderData?.game.name ?? "Jogo"} | Neon Fortune Arcade` },
        {
          name: "description",
          content: loaderData?.game.tagline ?? "Arcade privado com moedas fictícias",
        },
      ],
      links: presentationCss ? [{ rel: "stylesheet", href: presentationCss }] : [],
    };
  },
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
    content = <OlympusStormPremium />;
  } else if (game.slug === "candy-cascade") {
    content = <CandyCascadePremium />;
  } else if (game.slug === "neon-plinko") {
    content = <PlinkoReference />;
  } else if (game.slug === "neon-mines") {
    content = (
      <GameShell game={game}>
        <MinesGame />
      </GameShell>
    );
  } else {
    throw new Error(`Jogo jogável sem renderer dedicado: ${game.slug}`);
  }

  return <Suspense fallback={<GameLoading name={game.name} />}>{content}</Suspense>;
}
