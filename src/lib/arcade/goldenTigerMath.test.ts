import assert from "node:assert/strict";
import test from "node:test";

import {
  GOLDEN_TIGER_MAX_RETRIGGERS,
  evaluateGoldenTiger,
  goldenTigerBonusForScatters,
  goldenTigerScatterProbability,
  goldenTigerTriggerProbability,
  goldenTigerWinTier,
  makeGoldenTigerGrid,
} from "./goldenTigerMath";

test("Golden Tiger base bonus frequency stays inside the requested rare-feature band", () => {
  const trigger = goldenTigerTriggerProbability("base");
  assert.ok(trigger >= 1 / 120, `expected at least 1/120, got ${trigger}`);
  assert.ok(trigger <= 1 / 70, `expected at most 1/70, got ${trigger}`);
});

test("free-spins scatters are controlled separately and are rarer than base scatters", () => {
  assert.ok(
    goldenTigerScatterProbability("freeSpins") < goldenTigerScatterProbability("base"),
  );
  assert.ok(goldenTigerTriggerProbability("freeSpins") < goldenTigerTriggerProbability("base"));
});

test("base and retrigger awards use distinct schedules", () => {
  assert.equal(goldenTigerBonusForScatters(2, "base"), 0);
  assert.equal(goldenTigerBonusForScatters(3, "base"), 8);
  assert.equal(goldenTigerBonusForScatters(4, "base"), 12);
  assert.equal(goldenTigerBonusForScatters(5, "base"), 20);

  assert.equal(goldenTigerBonusForScatters(2, "freeSpins"), 0);
  assert.equal(goldenTigerBonusForScatters(3, "freeSpins"), 5);
  assert.equal(goldenTigerBonusForScatters(4, "freeSpins"), 8);
  assert.equal(goldenTigerBonusForScatters(5, "freeSpins"), 12);
  assert.equal(GOLDEN_TIGER_MAX_RETRIGGERS, 2);
});

test("result generation remains deterministic when an rng is supplied", () => {
  const grid = makeGoldenTigerGrid("base", () => 0);
  assert.equal(grid.length, 15);
  assert.ok(grid.every((symbol) => symbol === "wild"));

  const result = evaluateGoldenTiger(grid, 100, "base");
  assert.equal(result.scatterCount, 0);
  assert.equal(result.bonusAward, 0);
  assert.ok(result.payout > 0);
});

test("win tiers scale presentation intensity without changing payout", () => {
  assert.equal(goldenTigerWinTier(199, 100), "none");
  assert.equal(goldenTigerWinTier(200, 100), "small");
  assert.equal(goldenTigerWinTier(500, 100), "nice");
  assert.equal(goldenTigerWinTier(1_500, 100), "big");
  assert.equal(goldenTigerWinTier(3_000, 100), "mega");
});
