import assert from "node:assert/strict";
import test from "node:test";

import {
  FORTUNE_FEATURE_FULL_GRID_MULTIPLIER,
  FORTUNE_FEATURE_TRIGGER_CHANCE,
  evaluateFortuneFeatureGrid,
  pickFortuneFeatureSymbol,
  rollFortuneFeatureTrigger,
  runFortuneFeature,
} from "./goldenTigerFortuneFeature";

function seededRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

test("Fortune feature trigger uses the published 0.99 percent reference rate", () => {
  assert.equal(FORTUNE_FEATURE_TRIGGER_CHANCE, 0.0099);
  assert.equal(rollFortuneFeatureTrigger(() => 0.00989), true);
  assert.equal(rollFortuneFeatureTrigger(() => 0.0099), false);
});

test("feature selection never resolves to Wild", () => {
  const rolls = [0, 0.1];
  let cursor = 0;
  const symbol = pickFortuneFeatureSymbol(() => rolls[cursor++] ?? 0.5);
  assert.equal(symbol, "lion");
});

test("landed selected symbols stay sticky and the first empty respin ends the feature", () => {
  const rolls = [0.05, ...Array.from({ length: 8 }, () => 0.5), ...Array.from({ length: 8 }, () => 0.5)];
  let cursor = 0;
  const result = runFortuneFeature(100, () => rolls[cursor++] ?? 0.5, "orange");

  assert.equal(result.steps.length, 2);
  assert.deepEqual(result.steps[0]?.addedIndices, [0]);
  assert.equal(result.steps[1]?.addedIndices.length, 0);
  assert.equal(result.steps[1]?.ended, true);
  assert.equal(result.finalGrid[0], "orange");
  assert.equal(result.respinsUsed, 2);
});

test("feature reels contain only selected symbol, Wild or blank", () => {
  const rolls = [0, 0.05, ...Array.from({ length: 7 }, () => 0.5), ...Array.from({ length: 7 }, () => 0.5)];
  let cursor = 0;
  const result = runFortuneFeature(10, () => rolls[cursor++] ?? 0.5, "orange");
  const allowed = new Set(["orange", "wild", null]);
  assert.ok(result.finalGrid.every((symbol) => allowed.has(symbol)));
  assert.equal(result.finalGrid[0], "wild");
  assert.equal(result.finalGrid[1], "orange");
});

test("full 3x3 participation applies the verified x10 rule", () => {
  const result = runFortuneFeature(100, () => 0.05, "orange");
  const base = evaluateFortuneFeatureGrid(Array.from({ length: 9 }, () => "orange"), "orange", 100);

  assert.equal(result.isFullGrid, true);
  assert.equal(result.respinsUsed, 1);
  assert.equal(result.lines, 5);
  assert.equal(result.payout, base.payout);
  assert.equal(result.payout, Math.round(5 * 2.1 * 100 * FORTUNE_FEATURE_FULL_GRID_MULTIPLIER));
});

test("feature calibration stays bounded and full grids remain uncommon", () => {
  const rng = seededRng(0x7f07cafe);
  const samples = 30_000;
  let totalRespins = 0;
  let fullGrids = 0;

  for (let index = 0; index < samples; index += 1) {
    const result = runFortuneFeature(1, rng);
    totalRespins += result.respinsUsed;
    if (result.isFullGrid) fullGrids += 1;
  }

  const averageRespins = totalRespins / samples;
  const fullGridRate = fullGrids / samples;
  assert.ok(averageRespins > 1.5 && averageRespins < 3.5, `unexpected average respins: ${averageRespins}`);
  assert.ok(fullGridRate < 0.005, `full grid too frequent: ${fullGridRate}`);
});

test("injected RNG keeps the feature deterministic", () => {
  const first = runFortuneFeature(50, seededRng(20260908));
  const second = runFortuneFeature(50, seededRng(20260908));
  assert.deepEqual(first, second);
});
