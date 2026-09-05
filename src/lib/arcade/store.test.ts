import assert from "node:assert/strict";
import test from "node:test";

import { arcadeActions, STARTING_BALANCE, TOPUP_AMOUNT } from "./store";

test("coin topup adds exactly the configured amount while refill remains separate", () => {
  arcadeActions.resetAll();

  assert.equal(arcadeActions.getBalance(), STARTING_BALANCE);
  assert.equal(arcadeActions.debitCoins(900_000), true);
  assert.equal(arcadeActions.getBalance(), 100_000);

  arcadeActions.addCoins();
  assert.equal(arcadeActions.getBalance(), 100_000 + TOPUP_AMOUNT);

  arcadeActions.refillToStart();
  assert.equal(arcadeActions.getBalance(), STARTING_BALANCE);

  arcadeActions.addCoins(Number.NaN);
  arcadeActions.addCoins(-TOPUP_AMOUNT);
  assert.equal(arcadeActions.getBalance(), STARTING_BALANCE);

  arcadeActions.resetAll();
});
