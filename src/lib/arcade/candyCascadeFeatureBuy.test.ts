import assert from "node:assert/strict";
import test from "node:test";

import {
  CANDY_FEATURE_BUY_COST_MULTIPLIER,
  candyFeatureBuyAvailability,
  candyFeatureBuyCost,
  createCandyFeaturePurchase,
  createCandyFeaturePurchaseLock,
} from "./candyCascadeFeatureBuy";
import { CANDY_FEATURE_BUY_INITIAL_SPINS, planCandyFeature } from "./candyCascadeMath";
import { STARTING_BALANCE, arcadeActions } from "./store";

test("Candy feature buy cost uses the independently calibrated 14.1x multiple", () => {
  assert.equal(CANDY_FEATURE_BUY_COST_MULTIPLIER, 14.1);
  assert.equal(candyFeatureBuyCost(100), 1_410);
  assert.equal(candyFeatureBuyCost(200), 2_820);
  assert.equal(candyFeatureBuyCost(0), 0);
});

test("Candy feature buy availability blocks every unsafe state", () => {
  const base = {
    balance: 100_000,
    bet: 100,
    spinning: false,
    bonusActive: false,
    autoLeft: 0,
    pending: false,
    modalProcessing: false,
  };
  assert.equal(candyFeatureBuyAvailability(base).allowed, true);
  assert.equal(candyFeatureBuyAvailability({ ...base, balance: 100 }).reason, "insufficientBalance");
  assert.equal(candyFeatureBuyAvailability({ ...base, spinning: true }).reason, "spinning");
  assert.equal(candyFeatureBuyAvailability({ ...base, bonusActive: true }).reason, "bonusActive");
  assert.equal(candyFeatureBuyAvailability({ ...base, autoLeft: 1 }).reason, "autoplayActive");
  assert.equal(candyFeatureBuyAvailability({ ...base, pending: true }).reason, "pending");
  assert.equal(candyFeatureBuyAvailability({ ...base, modalProcessing: true }).reason, "modalProcessing");
});

test("purchase lock turns double click into one acquisition", () => {
  const lock = createCandyFeaturePurchaseLock();
  assert.equal(lock.acquire(), true);
  assert.equal(lock.acquire(), false);
  assert.equal(lock.isLocked(), true);
  lock.release();
  assert.equal(lock.acquire(), true);
});

test("Candy feature purchase always starts the normal 10-spin Sugar Party", () => {
  const purchase = createCandyFeaturePurchase(200);
  assert.equal(purchase.initialSpins, CANDY_FEATURE_BUY_INITIAL_SPINS);
  assert.equal(purchase.cost, candyFeatureBuyCost(200));
});

test("fictional accounting is one debit plus one aggregate feature credit", () => {
  arcadeActions.resetAll();
  const bet = 100;
  const cost = candyFeatureBuyCost(bet);
  const plan = planCandyFeature(bet, 10, () => 0.42);
  const starting = arcadeActions.getBalance();

  assert.equal(arcadeActions.debitCoins(cost), true);
  assert.equal(arcadeActions.getBalance(), starting - cost);
  if (plan.payout > 0) arcadeActions.credit(plan.payout);
  assert.equal(arcadeActions.getBalance(), starting - cost + plan.payout);

  const after = arcadeActions.getBalance();
  assert.equal(arcadeActions.debitCoins(STARTING_BALANCE + 1), false);
  assert.equal(arcadeActions.getBalance(), after);
  arcadeActions.resetAll();
});
