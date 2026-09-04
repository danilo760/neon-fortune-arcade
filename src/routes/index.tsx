import { createFileRoute } from "@tanstack/react-router";
import { PlinkoReference } from "@/components/arcade/PlinkoReference";

export const Route = createFileRoute("/")({ component: PlinkoReference });
