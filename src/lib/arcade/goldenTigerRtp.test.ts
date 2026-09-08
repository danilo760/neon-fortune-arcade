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

test("Neon Golden Tiger combined calibration stays near the published 96.81% RTP reference", () => {
  const rng = seededRng(0x09681a11);
  const spins = 150_000;
  const bet = 100;
  let totalPayout = 0;
  let featureTriggers = 0;

  for (let spin = 0; spin < spins; spin += 1) {
    const baseGrid = makeGoldenTigerGrid(rng);
    totalPayout += evaluateGoldenTiger(baseGrid, bet).payout;

    if (rollFortuneFeatureTrigger(rng)) {
      featureTriggers += 1;
      totalPayout += runFortuneFeature(bet, rng).payout;
    }
  }

  const simulatedRtp = totalPayout / (spins * bet);
  const observedFeatureRate = featureTriggers / spins;

  // This is a Neon-original calibration guard around the public 96.81% target,
  // not a claim that our undisclosed reel weights reproduce PG SOFT internals.
  assert.ok(simulatedRtp >= 0.95, `combined RTP too low: ${simulatedRtp}`);
  assert.ok(simulatedRtp <= 0.99, `combined RTP too high: ${simulatedRtp}`);
  assert.ok(observedFeatureRate >= 0.0085, `feature rate too low: ${observedFeatureRate}`);
  assert.ok(observedFeatureRate <= 0.0115, `feature rate too high: ${observedFeatureRate}`);
});
