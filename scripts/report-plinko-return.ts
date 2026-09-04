import {
  PLINKO_ROWS,
  plinkoExpectedReturn,
  plinkoPayouts,
  plinkoVariance,
  type PlinkoRisk,
} from "../src/lib/arcade/plinko";

const risks: PlinkoRisk[] = ["baixo", "medio", "alto"];
const report = risks.flatMap((risk) =>
  PLINKO_ROWS.map((rows) => {
    const payouts = plinkoPayouts(risk, rows);
    return {
      risk,
      rows,
      expectedReturn: Number(plinkoExpectedReturn(rows, payouts).toFixed(6)),
      variance: Number(plinkoVariance(rows, payouts).toFixed(6)),
      min: Math.min(...payouts),
      max: Math.max(...payouts),
    };
  }),
);

console.table(report);
