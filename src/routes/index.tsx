import { createFileRoute } from "@tanstack/react-router";

import "@/components/arcade/PlinkoBallPremium.css";
import { PlinkoReference } from "@/components/arcade/PlinkoReference";

export const Route = createFileRoute("/")({ component: PlinkoReference });
