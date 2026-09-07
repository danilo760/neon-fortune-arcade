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


test("full grid multiplier is independent of the Wild position", () => {
  for (let index = 0; index < 9; index++) {
    const grid = Array.from({ length: 9 }, (_, cell) => cell === index ? "wild" as const : "ingot" as const);
    const result = evaluateGoldenTiger(grid, 10, "base");
    assert.equal(result.isFullGrid, true);
    assert.equal(result.payout, 4_000);
  }
});

test("mixed or scatter grids do not receive the full grid multiplier", () => {
  assert.equal(evaluateGoldenTiger(["wild", "ingot", "jade", "ingot", "ingot", "ingot", "ingot", "ingot", "ingot"], 10, "base").isFullGrid, false);
  const result = evaluateGoldenTiger(Array(9).fill("scatter"), 10, "base");
  assert.equal(result.isFullGrid, false);
  assert.equal(result.payout, 0);
  assert.equal(result.bonusAward, 0);
});

test("respins reset only on a new lock and otherwise expire", () => {
  const grid = ["ingot", "orange", "jade", "orange", "wild", "jade", "lantern", "orange", "firecracker"] as const;
  const state = createGoldenTigerRespin(grid, () => 0)!;
  let next = respinGoldenTigerGrid(grid, state, () => .99);
  assert.equal(next.state.spinsLeft, 2);
  next = respinGoldenTigerGrid(next.grid, next.state, () => .99);
  next = respinGoldenTigerGrid(next.grid, next.state, () => .99);
  assert.equal(next.state.spinsLeft, 0);
  const filled = respinGoldenTigerGrid(grid, {...state, spinsLeft: 1}, () => 0);
  assert.equal(filled.state.spinsLeft, 3);
  assert.equal(filled.state.locked.size, 9);
});
