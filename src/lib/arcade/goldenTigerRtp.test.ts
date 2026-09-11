import assert from "node:assert/strict";
import test from "node:test";

import {
  rollFortuneFeatureTrigger,
  runFortuneFeature,
} from "./goldenTigerFortuneFeature";
import {
  evaluateGoldenTiger,
  makeGoldenTigerGrid,
} from "./goldenTigerMath";

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

test("Neon Golden Tiger calibration stays near the published 96.81% RTP reference", () => {
  const rng = seededRng(0x09681a11);
  const spins = 150_000;
  const bet = 100;
  let totalPayout = 0;
  let baseSettledPayout = 0;
  let featurePayout = 0;
  let featureTriggers = 0;

  for (let spin = 0; spin < spins; spin += 1) {
    const baseGrid = makeGoldenTigerGrid(rng);
    const basePayout = evaluateGoldenTiger(baseGrid, bet).payout;

    if (rollFortuneFeatureTrigger(rng)) {
      featureTriggers += 1;
      // The verified wording describes the randomly triggered feature as the
      // spin resolution: when it ends, its wins are paid. Do not stack a hidden
      // base-grid payout on top of the feature outcome.
      const payout = runFortuneFeature(bet, rng).payout;
      featurePayout += payout;
      totalPayout += payout;
    } else {
      baseSettledPayout += basePayout;
      totalPayout += basePayout;
    }
  }

  const simulatedRtp = totalPayout / (spins * bet);
  const observedFeatureRate = featureTriggers / spins;
  const baseContribution = baseSettledPayout / (spins * bet);
  const featureContribution = featurePayout / (spins * bet);

  // Public Fortune Tiger material reports 64.96% main-game + 31.85% feature.
  // We target the same broad distribution with original Neon weights/strips.
  assert.ok(simulatedRtp >= 0.95, `combined RTP too low: ${simulatedRtp}`);
  assert.ok(simulatedRtp <= 0.99, `combined RTP too high: ${simulatedRtp}`);
  assert.ok(baseContribution >= 0.61 && baseContribution <= 0.69, `base contribution out of band: ${baseContribution}`);
  assert.ok(featureContribution >= 0.27 && featureContribution <= 0.37, `feature contribution out of band: ${featureContribution}`);
  assert.ok(observedFeatureRate >= 0.0085, `feature rate too low: ${observedFeatureRate}`);
  assert.ok(observedFeatureRate <= 0.0115, `feature rate too high: ${observedFeatureRate}`);
});
