import assert from "node:assert/strict";
import test from "node:test";

import {
  createGoldenTigerRespin,
  evaluateGoldenTiger,
  makeGoldenTigerGrid,
  respinGoldenTigerGrid,
  type GoldenTigerSymbolId,
} from "./goldenTigerMath";

test("Golden Tiger produces a deterministic 3 by 3 grid", () => {
  const grid = makeGoldenTigerGrid("base", () => 0);
  assert.equal(grid.length, 9);
  assert.ok(grid.every((symbol) => symbol === "wild"));
});

test("full locked grid pays x10", () => {
  const grid = Array.from({ length: 9 }, () => "ingot" as const);
  const result = evaluateGoldenTiger(grid, 10, "base");
  assert.equal(result.isFullGrid, true);
  assert.equal(result.payout, 4_000);
});

test("full grid starting with a Wild still pays x10", () => {
  const grid: GoldenTigerSymbolId[] = [
    "wild", "ingot", "ingot",
    "ingot", "wild", "ingot",
    "ingot", "ingot", "wild",
  ];
  const result = evaluateGoldenTiger(grid, 10, "base");
  assert.equal(result.isFullGrid, true);
  assert.equal(result.payout, 4_000);
  assert.equal(result.winning.size, 9);
});

test("an all-Wild grid counts as a full grid", () => {
  const grid = Array.from({ length: 9 }, () => "wild" as const);
  const result = evaluateGoldenTiger(grid, 10, "base");
  assert.equal(result.isFullGrid, true);
  assert.equal(result.payout, 12_500);
});

test("a grid with a mismatching cell is not a full grid", () => {
  const grid: GoldenTigerSymbolId[] = [
    "wild", "ingot", "ingot",
    "ingot", "wild", "ingot",
    "ingot", "ingot", "jade",
  ];
  const result = evaluateGoldenTiger(grid, 10, "base");
  assert.equal(result.isFullGrid, false);
});

test("a full grid of scatters is never a full-grid win", () => {
  const grid = Array.from({ length: 9 }, () => "scatter" as const);
  const result = evaluateGoldenTiger(grid, 10, "base");
  assert.equal(result.isFullGrid, false);
  assert.equal(result.payout, 0);
});

test("respins preserve locked symbols", () => {
  const grid = ["ingot", "orange", "jade", "orange", "wild", "jade", "lantern", "orange", "firecracker"] as const;
  const state = createGoldenTigerRespin(grid, () => 0);
  assert.ok(state);
  const result = respinGoldenTigerGrid(grid, state, () => 0.99);
  assert.equal(result.grid[0], "ingot");
  assert.equal(result.grid[4], "wild");
});

test("the respin feature never locks onto Wild as its chosen symbol", () => {
  const grid = ["wild", "wild", "jade", "wild", "wild", "jade", "wild", "wild", "jade"] as const;
  const state = createGoldenTigerRespin(grid, () => 0);
  assert.ok(state);
  assert.notEqual(state.target, "wild");
});
