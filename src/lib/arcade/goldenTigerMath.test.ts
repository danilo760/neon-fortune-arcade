import assert from "node:assert/strict";
import test from "node:test";

import { createGoldenTigerRespin, evaluateGoldenTiger, makeGoldenTigerGrid, respinGoldenTigerGrid } from "./goldenTigerMath";

test("Golden Tiger produces a deterministic 3 by 3 grid", () => {
  const grid = makeGoldenTigerGrid("base", () => 0);
  assert.equal(grid.length, 9);
  assert.ok(grid.every((symbol) => symbol === "wild"));
});
test("full locked grid pays x10", () => {
  const grid = Array.from({ length: 9 }, () => "ingot" as const);
  assert.equal(evaluateGoldenTiger(grid, 10, "base").payout, 4_000);
});
test("respins preserve locked symbols", () => {
  const grid = ["ingot", "orange", "jade", "orange", "wild", "jade", "lantern", "orange", "firecracker"] as const;
  const state = createGoldenTigerRespin(grid, () => 0);
  assert.ok(state);
  const result = respinGoldenTigerGrid(grid, state, () => 0.99);
  assert.equal(result.grid[0], "ingot");
  assert.equal(result.grid[4], "wild");
});
