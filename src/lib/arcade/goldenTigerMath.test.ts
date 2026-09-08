import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateGoldenTiger,
  goldenTigerWinTier,
  makeGoldenTigerGrid,
} from "./goldenTigerMath";

test("Golden Tiger base grid remains a deterministic 3x3 when RNG is injected", () => {
  const grid = makeGoldenTigerGrid(() => 0);
  assert.equal(grid.length, 9);
  assert.ok(grid.every((symbol) => symbol === "wild"));
});

test("five fixed paylines still evaluate the existing 3x3 base game", () => {
  const grid = Array.from({ length: 9 }, () => "orange" as const);
  const result = evaluateGoldenTiger(grid, 100);
  assert.equal(result.lines, 5);
  assert.equal(result.winning.size, 9);
  assert.equal(result.payout, 5 * 210);
});

test("wild substitutes for regular symbols without creating a new game symbol", () => {
  const grid = [
    "wild", "lion", "lion",
    "orange", "jade", "lantern",
    "ingot", "firecracker", "fortuneBag",
  ] as const;
  const result = evaluateGoldenTiger(grid, 100);
  assert.equal(result.lines, 1);
  assert.equal(result.payout, 800);
});

test("Gold Coin indexes block normal paylines", () => {
  const grid = Array.from({ length: 9 }, () => "orange" as const);
  const blocked = new Set([1, 4, 7]);
  const result = evaluateGoldenTiger(grid, 100, blocked);
  assert.equal(result.lines, 2);
  assert.equal(result.payout, 420);
});

test("win tiers only change presentation intensity", () => {
  assert.equal(goldenTigerWinTier(199, 100), "none");
  assert.equal(goldenTigerWinTier(200, 100), "small");
  assert.equal(goldenTigerWinTier(500, 100), "nice");
  assert.equal(goldenTigerWinTier(1_500, 100), "big");
  assert.equal(goldenTigerWinTier(3_000, 100), "mega");
});
