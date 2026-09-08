import assert from "node:assert/strict";
import test from "node:test";

import {
  GOLDEN_TIGER_FULL_GRID_MULTIPLIER,
  GOLDEN_TIGER_PAYOUT_SCALE,
  evaluateGoldenTiger,
  goldenTigerWinTier,
  makeGoldenTigerGrid,
} from "./goldenTigerMath";

test("Golden Tiger base grid remains a deterministic 3x3 when RNG is injected", () => {
  const grid = makeGoldenTigerGrid(() => 0);
  assert.equal(grid.length, 9);
  assert.ok(grid.every((symbol) => symbol === "wild"));
});

test("five fixed paylines apply x10 when all nine positions participate", () => {
  const grid = Array.from({ length: 9 }, () => "orange" as const);
  const result = evaluateGoldenTiger(grid, 100);
  assert.equal(result.lines, 5);
  assert.equal(result.winning.size, 9);
  assert.equal(result.isFullGrid, true);
  assert.equal(
    result.payout,
    Math.round(5 * 210 * GOLDEN_TIGER_FULL_GRID_MULTIPLIER * GOLDEN_TIGER_PAYOUT_SCALE),
  );
});

test("wild substitutes for regular symbols without creating a new game symbol", () => {
  const grid = [
    "wild", "lion", "lion",
    "orange", "jade", "lantern",
    "ingot", "firecracker", "fortuneBag",
  ] as const;
  const result = evaluateGoldenTiger(grid, 100);
  assert.equal(result.lines, 1);
  assert.equal(result.payout, Math.round(800 * GOLDEN_TIGER_PAYOUT_SCALE));
  assert.equal(result.isFullGrid, false);
});

test("blocked presentation cells prevent paylines and full-grid multiplication", () => {
  const grid = Array.from({ length: 9 }, () => "orange" as const);
  const blocked = new Set([0, 2]);
  const result = evaluateGoldenTiger(grid, 100, blocked);
  assert.equal(result.lines, 2);
  assert.equal(result.payout, Math.round(420 * GOLDEN_TIGER_PAYOUT_SCALE));
  assert.equal(result.isFullGrid, false);
});

test("payout scale is explicitly Neon-original calibration", () => {
  assert.equal(GOLDEN_TIGER_PAYOUT_SCALE, 1.195);
});

test("win tiers only change presentation intensity", () => {
  assert.equal(goldenTigerWinTier(199, 100), "none");
  assert.equal(goldenTigerWinTier(200, 100), "small");
  assert.equal(goldenTigerWinTier(500, 100), "nice");
  assert.equal(goldenTigerWinTier(1_500, 100), "big");
  assert.equal(goldenTigerWinTier(3_000, 100), "mega");
});
