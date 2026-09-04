import { createFileRoute } from "@tanstack/react-router";

import { GoldenTigerReference } from "@/components/arcade/GoldenTigerReference";

export const Route = createFileRoute("/")({ component: GoldenTigerReference });
