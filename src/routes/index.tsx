import { createFileRoute } from "@tanstack/react-router";

import { CandyCascadeReference } from "@/components/arcade/CandyCascadeReference";

export const Route = createFileRoute("/")({ component: CandyCascadeReference });