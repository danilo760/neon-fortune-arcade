import assert from "node:assert/strict";
import test from "node:test";

import { planGoldenTigerRound, createGoldenTigerRespin, evaluateGoldenTiger, makeGoldenTigerGrid, respinGoldenTigerGrid } from "./goldenTigerMath";

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


test("a complete round is planned before presentation without mutating its initial grid", () => {
  const first = planGoldenTigerRound(10, () => 0);
  assert.equal(first.initialGrid.length, 9);
  assert.equal(first.result.payout, 12_500);
  assert.equal(first.respins.length, 0);
  assert.equal(first.initialRespin?.locked.size, 9);
  const blank = planGoldenTigerRound(10, () => .99);
  assert.equal(blank.initialRespin, null);
  assert.equal(blank.respins.length, 0);
  assert.equal(blank.result.payout, 600);
});

test("round plan retains each respin snapshot and settles only its final grid", () => {
  let calls = 0;
  const plan = planGoldenTigerRound(10, () => {
    calls++;
    if (calls === 1) return .15;
    if (calls === 10 || calls === 11) return 0;
    return .99;
  });
  assert.equal(plan.initialGrid[0], "ingot");
  assert.equal(plan.initialRespin?.locked.size, 1);
  assert.equal(plan.respins.length, 3);
  assert.deepEqual(plan.respins.map(step => step.state.spinsLeft), [2, 1, 0]);
  assert.ok(plan.respins.every(step => step.grid[0] === "ingot"));
  assert.equal(plan.result.payout, evaluateGoldenTiger(plan.respins.at(-1)!.grid, 10, "base").payout);
});
