import assert from "node:assert/strict";
import test from "node:test";

import {
  PLINKO_ROWS,
  plinkoExpectedReturn,
  plinkoPayouts,
  plinkoVariance,
  type PlinkoRisk,
} from "./plinko";

const RISKS: PlinkoRisk[] = ["baixo", "medio", "alto"];

test("every Plinko risk × rows configuration stays near the common fictional return", () => {
  for (const risk of RISKS) {
    for (const rows of PLINKO_ROWS) {
      const expected = plinkoExpectedReturn(rows, plinkoPayouts(risk, rows));
      assert.ok(expected >= 0.94 && expected <= 0.97, `${risk} × ${rows}: ${expected}`);
    }
  }
});

test("risk changes variance more than average return", () => {
  for (const rows of PLINKO_ROWS) {
    const low = plinkoPayouts("baixo", rows);
    const medium = plinkoPayouts("medio", rows);
    const high = plinkoPayouts("alto", rows);
    assert.ok(plinkoVariance(rows, low) < plinkoVariance(rows, medium));
    assert.ok(plinkoVariance(rows, medium) < plinkoVariance(rows, high));
    assert.ok(Math.max(...low) < Math.max(...medium));
    assert.ok(Math.max(...medium) < Math.max(...high));
  }
});

test("normalized tables keep one multiplier for every possible bucket", () => {
  for (const risk of RISKS) {
    for (const rows of PLINKO_ROWS) {
      const payouts = plinkoPayouts(risk, rows);
      assert.equal(payouts.length, rows + 1);
      assert.ok(payouts.every((value) => Number.isFinite(value) && value > 0));
    }
  }
});
