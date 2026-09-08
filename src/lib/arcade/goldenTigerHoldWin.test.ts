import assert from "node:assert/strict";
import test from "node:test";

import {
  GOLD_COIN_TRIGGER_CHANCE,
  GOLD_COIN_VALUE_TABLE,
  HOLD_WIN_FEATURE_BUY_COST_MULTIPLIER,
  HOLD_WIN_FULL_GRID_BONUS,
  HOLD_WIN_RESPIN_RESET,
  goldCoinTriggerProbability,
  holdWinFeatureBuyCost,
  rollBaseGoldCoinGrid,
  rollGoldCoinValue,
  runHoldWinFeature,
} from "./goldenTigerHoldWin";

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

test("base coin trigger is calibrated inside the requested 1/80 to 1/50 band", () => {
  assert.equal(GOLD_COIN_TRIGGER_CHANCE, 1 / 600);
  const analytic = goldCoinTriggerProbability();
  assert.ok(analytic >= 1 / 80, `trigger too rare: ${analytic}`);
  assert.ok(analytic <= 1 / 50, `trigger too frequent: ${analytic}`);

  const rng = seededRng(0x51f15e);
  const samples = 100_000;
  let triggers = 0;
  for (let index = 0; index < samples; index += 1) {
    if (rollBaseGoldCoinGrid(rng).length > 0) triggers += 1;
  }
  const observed = triggers / samples;
  assert.ok(observed >= 1 / 80, `observed trigger too rare: ${observed}`);
  assert.ok(observed <= 1 / 50, `observed trigger too frequent: ${observed}`);
});

test("coin value distribution follows the named weighted table", () => {
  const rng = seededRng(0xc01dca5e);
  const samples = 120_000;
  const counts = new Map<number, number>();
  for (let index = 0; index < samples; index += 1) {
    const value = rollGoldCoinValue(rng);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const totalWeight = GOLD_COIN_VALUE_TABLE.reduce((sum, item) => sum + item.weight, 0);
  for (const item of GOLD_COIN_VALUE_TABLE) {
    const expected = item.weight / totalWeight;
    const observed = (counts.get(item.multiplier) ?? 0) / samples;
    assert.ok(
      Math.abs(observed - expected) < 0.008,
      `${item.multiplier}x expected ${expected}, got ${observed}`,
    );
  }
});

test("new coin resets respins to three and misses count down to zero", () => {
  const sequence = [
    0,
    0,
    ...Array.from({ length: 7 }, () => 0.5),
    ...Array.from({ length: 21 }, () => 0.5),
  ];
  let cursor = 0;
  const rng = () => sequence[cursor++] ?? 0.5;
  const result = runHoldWinFeature(1, rng, [{ index: 0, value: 1 }]);

  assert.equal(result.steps[0]?.addedIndices.length, 1);
  assert.equal(result.steps[0]?.respinsRemaining, HOLD_WIN_RESPIN_RESET);
  assert.deepEqual(
    result.steps.slice(-3).map((step) => step.respinsRemaining),
    [2, 1, 0],
  );
  assert.ok(result.steps.every((step) => step.respinsRemaining <= HOLD_WIN_RESPIN_RESET));
});

test("feature ends after three misses without charging another bet", () => {
  const result = runHoldWinFeature(200, () => 0.5, [{ index: 4, value: 2 }]);
  assert.equal(result.respinsUsed, 3);
  assert.equal(result.totalCoins, 1);
  assert.equal(result.totalValue, 2);
  assert.equal(result.payout, 400);
  assert.equal(result.steps.at(-1)?.respinsRemaining, 0);
});

test("full grid applies the x10 climax multiplier", () => {
  const initial = Array.from({ length: 9 }, (_, index) => ({ index, value: 1 as const }));
  const result = runHoldWinFeature(100, () => 0.5, initial);
  assert.equal(result.isFullGrid, true);
  assert.equal(result.totalCoins, 9);
  assert.equal(result.totalValue, 9);
  assert.equal(result.payout, 9 * 100 * HOLD_WIN_FULL_GRID_BONUS);
  assert.equal(result.respinsUsed, 0);
});

test("full grid remains orders of magnitude rarer than entering the feature", () => {
  const rng = seededRng(0xf0119d);
  const activations = 120_000;
  let fullGrids = 0;
  for (let index = 0; index < activations; index += 1) {
    if (runHoldWinFeature(1, rng).isFullGrid) fullGrids += 1;
  }
  const rate = fullGrids / activations;
  assert.ok(rate < 1 / 10_000, `full grid is too frequent: ${fullGrids}/${activations}`);
});

test("feature buy cost is calibrated by Monte Carlo near 95 percent return", () => {
  const rng = seededRng(0x95f3a7);
  const activations = 100_000;
  let totalPayout = 0;
  for (let index = 0; index < activations; index += 1) {
    totalPayout += runHoldWinFeature(1, rng).payout;
  }
  const averagePayout = totalPayout / activations;
  const simulatedRtp = averagePayout / HOLD_WIN_FEATURE_BUY_COST_MULTIPLIER;
  assert.ok(simulatedRtp >= 0.93, `feature-buy RTP too low: ${simulatedRtp}`);
  assert.ok(simulatedRtp <= 0.98, `feature-buy RTP too high: ${simulatedRtp}`);
  assert.equal(holdWinFeatureBuyCost(100), 670);
});

test("injected RNG produces deterministic feature outcomes", () => {
  const first = runHoldWinFeature(50, seededRng(12345));
  const second = runHoldWinFeature(50, seededRng(12345));
  assert.deepEqual(first, second);
});
