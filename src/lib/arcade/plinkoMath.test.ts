import assert from "node:assert/strict";
import test from "node:test";

import {
  PLINKO_ROWS,
  PLINKO_TARGET_RETURN,
  dropBall,
  plinkoExpectedReturn,
  plinkoPayouts,
  plinkoVariance,
  type PlinkoRisk,
} from "./plinko";

const RISKS: readonly PlinkoRisk[] = ["baixo", "medio", "alto"];

test("every Neon Plinko table has one bucket per terminal path", () => {
  for (const risk of RISKS) {
    for (const rows of PLINKO_ROWS) {
      assert.equal(plinkoPayouts(risk, rows).length, rows + 1);
    }
  }
});

test("normalized payout tables stay tightly aligned to the 96% fictional target return", () => {
  for (const risk of RISKS) {
    for (const rows of PLINKO_ROWS) {
      const expected = plinkoExpectedReturn(rows, plinkoPayouts(risk, rows));
      assert.ok(
        Math.abs(expected - PLINKO_TARGET_RETURN) < 0.001,
        `${risk}/${rows} expected return ${expected} drifted from ${PLINKO_TARGET_RETURN}`,
      );
    }
  }
});

test("risk selection increases variance for every supported row count", () => {
  for (const rows of PLINKO_ROWS) {
    const low = plinkoVariance(rows, plinkoPayouts("baixo", rows));
    const medium = plinkoVariance(rows, plinkoPayouts("medio", rows));
    const high = plinkoVariance(rows, plinkoPayouts("alto", rows));
    assert.ok(low < medium, `${rows} rows should make medium risk more volatile than low risk`);
    assert.ok(medium < high, `${rows} rows should make high risk more volatile than medium risk`);
  }
});

test("a deterministic path always lands in the bucket represented by its right moves", () => {
  const sequence = [0.1, 0.9, 0.9, 0.1, 0.9, 0.1, 0.1, 0.9];
  let cursor = 0;
  const outcome = dropBall(() => sequence[cursor++] ?? 0.1, sequence.length);
  assert.deepEqual(outcome.path, [0, 1, 1, 0, 1, 0, 0, 1]);
  assert.equal(outcome.bucket, 4);
  assert.equal(outcome.bucket, outcome.path.reduce((sum, move) => sum + move, 0));
});
