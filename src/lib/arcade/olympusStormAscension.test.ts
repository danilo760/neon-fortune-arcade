import assert from "node:assert/strict";
import test from "node:test";

import {
  OLYMPUS_FEATURE_BUY_COST_MULTIPLIER,
  OLYMPUS_FEATURE_BUY_INITIAL_SPINS,
  OLYMPUS_MAX_RETRIGGERS,
  advanceOlympusStormLevel,
  countOlympusScatters,
  findOlympusClusters,
  olympusFeatureBuyCost,
  olympusFreeSpinsAward,
  planOlympusFeature,
  planOlympusRound,
  type OlympusSymbolId,
} from "./olympusStormMath";
import {
  createOlympusFeatureBuyLock,
  olympusFeatureBuyAvailability,
} from "./olympusStormFeatureBuy";
import { createSeededRng } from "./rng";

test("Storm Orb awards natural 8/12/18 free spins for 3/4/5+ scatters", () => {
  assert.equal(olympusFreeSpinsAward("base", 2), 0);
  assert.equal(olympusFreeSpinsAward("base", 3), 8);
  assert.equal(olympusFreeSpinsAward("base", 4), 12);
  assert.equal(olympusFreeSpinsAward("base", 5), 18);
  assert.equal(olympusFreeSpinsAward("base", 8), 18);
});

test("Storm Orb retriggers award 5/8/12 spins in free-spin mode", () => {
  assert.equal(olympusFreeSpinsAward("freeSpins", 2), 0);
  assert.equal(olympusFreeSpinsAward("freeSpins", 3), 5);
  assert.equal(olympusFreeSpinsAward("freeSpins", 4), 8);
  assert.equal(olympusFreeSpinsAward("freeSpins", 5), 12);
});

test("Storm Orb never becomes a paying cluster", () => {
  const grid: OlympusSymbolId[] = Array.from({ length: 30 }, () => "scatter");
  assert.equal(countOlympusScatters(grid), 30);
  assert.deepEqual(findOlympusClusters(grid, 100), []);
});

test("Storm Level progression carries excess energy and caps at level 5", () => {
  assert.deepEqual(advanceOlympusStormLevel(1, 0, 1), { level: 1, energy: 1 });
  assert.deepEqual(advanceOlympusStormLevel(1, 1, 1), { level: 2, energy: 0 });
  assert.deepEqual(advanceOlympusStormLevel(2, 2, 2), { level: 3, energy: 1 });
  assert.deepEqual(advanceOlympusStormLevel(5, 4, 9), { level: 5, energy: 13 });
});

test("Storm Level persists between every planned free spin and resets for a new feature", () => {
  const feature = planOlympusFeature(100, 18, createSeededRng(20260904));
  let previousLevel = 1;
  let previousEnergy = 0;
  for (const spin of feature.spins) {
    assert.equal(spin.round.stormLevelStart, previousLevel);
    assert.equal(spin.round.stormEnergyStart, previousEnergy);
    assert.ok(spin.round.stormLevelEnd >= spin.round.stormLevelStart);
    previousLevel = spin.round.stormLevelEnd;
    previousEnergy = spin.round.stormEnergyEnd;
  }

  const fresh = planOlympusFeature(100, 8, createSeededRng(20260904));
  assert.equal(fresh.spins[0]?.round.stormLevelStart, 1);
  assert.equal(fresh.spins[0]?.round.stormEnergyStart, 0);
});

test("feature payout equals the sum of all free-spin round payouts", () => {
  const rng = createSeededRng(777001);
  for (let index = 0; index < 80; index += 1) {
    const feature = planOlympusFeature(100, 8, rng);
    assert.equal(feature.payout, feature.spins.reduce((sum, spin) => sum + spin.round.payout, 0));
    assert.ok(feature.retriggers <= OLYMPUS_MAX_RETRIGGERS);
    assert.ok(feature.finalSpins >= OLYMPUS_FEATURE_BUY_INITIAL_SPINS);
    assert.ok(feature.finalStormLevel >= 1 && feature.finalStormLevel <= 5);
  }
});

test("base round keeps result precomputed and reports natural trigger from initial grid only", () => {
  const rng = createSeededRng(991827);
  for (let index = 0; index < 150; index += 1) {
    const round = planOlympusRound(100, rng);
    assert.equal(round.scatterCount, countOlympusScatters(round.initialGrid));
    assert.equal(round.freeSpinsAward, olympusFreeSpinsAward("base", round.scatterCount));
    assert.equal(round.payout, round.cascades.reduce((sum, cascade) => sum + cascade.payout, 0));
  }
});

test("Olympus feature buy uses its own clean 9x bet cost", () => {
  assert.equal(OLYMPUS_FEATURE_BUY_COST_MULTIPLIER, 9);
  assert.equal(olympusFeatureBuyCost(10), 90);
  assert.equal(olympusFeatureBuyCost(200), 1_800);
});

test("feature buy availability blocks insufficient balance, spin, auto, bonus, modal and pending", () => {
  const base = {
    balance: 10_000,
    bet: 100,
    spinning: false,
    bonusActive: false,
    autoLeft: 0,
    modalOpen: false,
    pending: false,
  };
  assert.equal(olympusFeatureBuyAvailability(base).allowed, true);
  assert.equal(olympusFeatureBuyAvailability({ ...base, balance: 899 }).reason, "insufficientBalance");
  assert.equal(olympusFeatureBuyAvailability({ ...base, spinning: true }).reason, "spinning");
  assert.equal(olympusFeatureBuyAvailability({ ...base, autoLeft: 3 }).reason, "autoplayActive");
  assert.equal(olympusFeatureBuyAvailability({ ...base, bonusActive: true }).reason, "bonusActive");
  assert.equal(olympusFeatureBuyAvailability({ ...base, modalOpen: true }).reason, "modalOpen");
  assert.equal(olympusFeatureBuyAvailability({ ...base, pending: true }).reason, "pending");
});

test("feature buy lock rejects double click until released", () => {
  const lock = createOlympusFeatureBuyLock();
  assert.equal(lock.acquire(), true);
  assert.equal(lock.acquire(), false);
  assert.equal(lock.isLocked(), true);
  lock.release();
  assert.equal(lock.acquire(), true);
});
