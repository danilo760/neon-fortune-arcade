import type { Rng } from "./rng";

export type PlinkoRisk = "baixo" | "medio" | "alto";

export const PLINKO_ROWS = [12, 13, 14, 15, 16] as const;

const PAYOUT_TABLES: Record<PlinkoRisk, Record<number, number[]>> = {
  baixo: {
    12: [8, 3, 1.6, 1.2, 1, 0.7, 0.5, 0.7, 1, 1.2, 1.6, 3, 8],
    13: [10, 3, 1.8, 1.3, 1, 0.7, 0.5, 0.5, 0.7, 1, 1.3, 1.8, 3, 10],
    14: [12, 4, 1.9, 1.4, 1.1, 1, 0.5, 0.3, 0.5, 1, 1.1, 1.4, 1.9, 4, 12],
    15: [14, 5, 2, 1.4, 1.1, 1, 0.7, 0.5, 0.5, 0.7, 1, 1.1, 1.4, 2, 5, 14],
    16: [16, 6, 2, 1.5, 1.2, 1, 0.7, 0.5, 0.3, 0.5, 0.7, 1, 1.2, 1.5, 2, 6, 16],
  },
  medio: {
    12: [24, 8, 3, 1.4, 1, 0.6, 0.3, 0.6, 1, 1.4, 3, 8, 24],
    13: [33, 11, 4, 1.8, 1, 0.5, 0.3, 0.3, 0.5, 1, 1.8, 4, 11, 33],
    14: [45, 14, 5, 2, 1.2, 0.6, 0.3, 0.2, 0.3, 0.6, 1.2, 2, 5, 14, 45],
    15: [60, 18, 6, 2.4, 1.3, 0.6, 0.3, 0.2, 0.2, 0.3, 0.6, 1.3, 2.4, 6, 18, 60],
    16: [80, 22, 7, 3, 1.5, 0.6, 0.3, 0.2, 0.2, 0.2, 0.3, 0.6, 1.5, 3, 7, 22, 80],
  },
  alto: {
    12: [80, 16, 5, 1.6, 0.6, 0.3, 0.2, 0.3, 0.6, 1.6, 5, 16, 80],
    13: [130, 26, 6, 2, 0.7, 0.3, 0.2, 0.2, 0.3, 0.7, 2, 6, 26, 130],
    14: [200, 40, 8, 2.4, 0.8, 0.3, 0.2, 0.2, 0.2, 0.3, 0.8, 2.4, 8, 40, 200],
    15: [320, 60, 11, 3, 0.9, 0.3, 0.2, 0.2, 0.2, 0.2, 0.3, 0.9, 3, 11, 60, 320],
    16: [500, 90, 15, 4, 1, 0.4, 0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 1, 4, 15, 90, 500],
  },
};

export function plinkoPayouts(risk: PlinkoRisk, rows: number): number[] {
  return PAYOUT_TABLES[risk][rows] ?? PAYOUT_TABLES[risk][16]!;
}

/** Returns the sequence of right-moves (1) / left-moves (0) and the final bucket index. */
export function dropBall(rng: Rng, rows: number): { path: number[]; bucket: number } {
  const path: number[] = [];
  let bucket = 0;
  for (let row = 0; row < rows; row++) {
    const right = rng() < 0.5 ? 0 : 1;
    path.push(right);
    bucket += right;
  }
  return { path, bucket };
}

export const RISK_LABELS: Record<PlinkoRisk, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};
