import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveGoldenTigerBasePaylines,
  resolveGoldenTigerFeaturePaylines,
} from "./goldenTigerPaylinePresentation";

const BET = 20;

test("payline presentation resolves only the actual base lines instead of inferring from the winning-cell union", () => {
  const grid = [
    "lion", "lion", "lion",
    "jade", "orange", "ingot",
    "firecracker", "lantern", "jade",
  ] as const;

  const lines = resolveGoldenTigerBasePaylines(grid, BET);

  assert.deepEqual(lines.map((line) => line.index), [0]);
  assert.deepEqual(lines[0]?.cells, [0, 1, 2]);
  assert.ok((lines[0]?.payout ?? 0) > 0);
});

test("payline presentation keeps full-grid multiplier out of each line beat", () => {
  const grid = Array.from({ length: 9 }, () => "lion") as Array<"lion">;

  const lines = resolveGoldenTigerBasePaylines(grid, BET);

  assert.equal(lines.length, 5);
  assert.equal(new Set(lines.map((line) => line.payout)).size, 1);
});

test("payline presentation resolves Fortune Feature lines through the existing feature evaluator", () => {
  const grid = [
    "jade", "wild", "jade",
    null, null, null,
    null, null, null,
  ] as const;

  const lines = resolveGoldenTigerFeaturePaylines(grid, "jade", BET);

  assert.deepEqual(lines.map((line) => line.index), [0]);
  assert.equal(lines[0]?.points, "0.5,0.5 1.5,0.5 2.5,0.5");
});
