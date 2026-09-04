import assert from "node:assert/strict";
import test from "node:test";

import { createMineField, minesMultiplier, nextMinesMultiplier } from "./mines";
import { createRng } from "./rng";

test("Mines multiplier remains progressive for every selectable risk", () => {
  for (const mines of [1, 3, 5, 10]) {
    let previous = 1;
    for (let revealed = 1; revealed <= 25 - mines; revealed += 1) {
      const current = minesMultiplier(mines, revealed);
      assert.ok(current >= previous, `${mines} mines regressed at reveal ${revealed}`);
      previous = current;
    }
  }
});

test("NEXT WIN equals the following safe reveal multiplier", () => {
  for (const mines of [1, 3, 5, 10]) {
    for (let revealed = 0; revealed < 25 - mines; revealed += 1) {
      assert.equal(nextMinesMultiplier(mines, revealed), minesMultiplier(mines, revealed + 1));
    }
  }
});

test("mine fields keep the exact requested count with unique cells", () => {
  for (const mines of [1, 3, 5, 10]) {
    const field = createMineField(createRng(1234 + mines), mines);
    assert.equal(field.length, mines);
    assert.equal(new Set(field).size, mines);
    assert.ok(field.every((index) => index >= 0 && index < 25));
  }
});
