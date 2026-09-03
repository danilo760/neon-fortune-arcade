import { createFileRoute } from "@tanstack/react-router";

import "@/components/arcade/GoldenTigerGame.css";
import { GoldenTigerCabinet } from "@/components/arcade/GoldenTigerCabinet";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  return <GoldenTigerCabinet />;
}
