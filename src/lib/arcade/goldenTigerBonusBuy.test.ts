import assert from "node:assert/strict";
import test from "node:test";

import {
  GOLDEN_TIGER_BONUS_BUY_MULTIPLIER,
  GOLDEN_TIGER_BUY_SELECTED_LAND_CHANCE,
  GOLDEN_TIGER_BUY_WILD_LAND_CHANCE,
  runPurchasedFortuneFeature,
} from "./goldenTigerBonusBuy";
import { createSeededRng } from "./rng";

test("Golden purchased feature uses its own richer sticky calibration", () => {
  assert.equal(GOLDEN_TIGER_BONUS_BUY_MULTIPLIER, 31);
  assert.equal(GOLDEN_TIGER_BUY_SELECTED_LAND_CHANCE, 0.25);
  assert.equal(GOLDEN_TIGER_BUY_WILD_LAND_CHANCE, 0.025);
});

test("Golden purchased feature stays close to the arcade fictional return target", () => {
  const rng = createSeededRng(20260909);
  const samples = 30_000;
  let totalPayout = 0;
  let fullGrids = 0;
  let payingFeatures = 0;

  for (let index = 0; index < samples; index += 1) {
    const result = runPurchasedFortuneFeature(1, rng);
    totalPayout += result.payout;
    if (result.isFullGrid) fullGrids += 1;
    if (result.payout > 0) payingFeatures += 1;
  }

  const returnRatio = totalPayout / (samples * GOLDEN_TIGER_BONUS_BUY_MULTIPLIER);
  const fullGridRate = fullGrids / samples;
  const payingRate = payingFeatures / samples;

  assert.ok(returnRatio > 0.94 && returnRatio < 1.02, `unexpected purchased-feature return: ${returnRatio}`);
  assert.ok(fullGridRate > 0.08 && fullGridRate < 0.14, `unexpected purchased full-grid rate: ${fullGridRate}`);
  assert.ok(payingRate > 0.65 && payingRate < 0.75, `unexpected purchased paying rate: ${payingRate}`);
});

test("Golden purchased feature remains deterministic with an injected RNG", () => {
  const first = runPurchasedFortuneFeature(100, createSeededRng(3109));
  const second = runPurchasedFortuneFeature(100, createSeededRng(3109));
  assert.deepEqual(first, second);
});
