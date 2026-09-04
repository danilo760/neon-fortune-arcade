import assert from "node:assert/strict";
import test from "node:test";

import {
  applyGoldenFortuneRetrigger,
  createGoldenFortunePurchaseLock,
  createGoldenFortuneSession,
  goldenFortuneAvailability,
} from "./goldenTigerFeatureBuy";
import {
  GOLDEN_TIGER_FEATURE_BUY_COST_MULTIPLIER,
  GOLDEN_TIGER_FEATURE_BUY_INITIAL_SPINS,
  goldenTigerFeatureBuyCost,
} from "./goldenTigerMath";
import { STARTING_BALANCE, arcadeActions } from "./store";

test("Golden Fortune cost scales from the current bet using the calibrated multiplier", () => {
  assert.equal(GOLDEN_TIGER_FEATURE_BUY_COST_MULTIPLIER, 14.5);
  assert.equal(goldenTigerFeatureBuyCost(200), 2_900);
  assert.equal(goldenTigerFeatureBuyCost(1_000), 14_500);
  assert.equal(goldenTigerFeatureBuyCost(0), 0);
});

test("Golden Fortune is available with sufficient fictional balance", () => {
  const state = goldenFortuneAvailability({
    balance: 10_000,
    bet: 200,
    spinning: false,
    bonusActive: false,
    autoLeft: 0,
    pending: false,
  });
  assert.equal(state.allowed, true);
  assert.equal(state.reason, null);
  assert.equal(state.cost, 2_900);
});

test("Golden Fortune blocks insufficient balance without a debit", () => {
  const state = goldenFortuneAvailability({
    balance: 2_899,
    bet: 200,
    spinning: false,
    bonusActive: false,
    autoLeft: 0,
    pending: false,
  });
  assert.equal(state.allowed, false);
  assert.equal(state.reason, "insufficientBalance");
});

test("Golden Fortune blocks spin, autoplay, bonus and pending states", () => {
  const base = { balance: 100_000, bet: 200, spinning: false, bonusActive: false, autoLeft: 0, pending: false };
  assert.equal(goldenFortuneAvailability({ ...base, spinning: true }).reason, "spinning");
  assert.equal(goldenFortuneAvailability({ ...base, autoLeft: 4 }).reason, "autoplayActive");
  assert.equal(goldenFortuneAvailability({ ...base, bonusActive: true }).reason, "bonusActive");
  assert.equal(goldenFortuneAvailability({ ...base, pending: true }).reason, "pending");
});

test("purchase lock admits exactly one concurrent activation", () => {
  const lock = createGoldenFortunePurchaseLock();
  assert.equal(lock.acquire(), true);
  assert.equal(lock.acquire(), false);
  assert.equal(lock.isLocked(), true);
  lock.release();
  assert.equal(lock.acquire(), true);
});

test("purchased Golden Fortune starts with exactly eight spins and retriggers never change cost", () => {
  const session = createGoldenFortuneSession(200);
  assert.equal(GOLDEN_TIGER_FEATURE_BUY_INITIAL_SPINS, 8);
  assert.equal(session.initialSpins, 8);
  assert.equal(session.spinsLeft, 8);
  assert.equal(session.cost, 2_900);

  const retriggered = applyGoldenFortuneRetrigger(session, 5);
  assert.equal(retriggered.spinsLeft, 13);
  assert.equal(retriggered.retriggers, 1);
  assert.equal(retriggered.cost, session.cost);

  const second = applyGoldenFortuneRetrigger(retriggered, 8);
  const capped = applyGoldenFortuneRetrigger(second, 12);
  assert.equal(second.retriggers, 2);
  assert.deepEqual(capped, second);
});

test("fictional coin debit is single-purpose and rejects insufficient balance", () => {
  arcadeActions.resetAll();
  assert.equal(arcadeActions.getBalance(), STARTING_BALANCE);
  assert.equal(arcadeActions.debitCoins(2_900), true);
  assert.equal(arcadeActions.getBalance(), STARTING_BALANCE - 2_900);
  const remaining = arcadeActions.getBalance();
  assert.equal(arcadeActions.debitCoins(STARTING_BALANCE + 1), false);
  assert.equal(arcadeActions.getBalance(), remaining);
  arcadeActions.resetAll();
});
