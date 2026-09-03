import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createMineField, minesMultiplier } from "./mines";
import { dropBall, plinkoPayouts } from "./plinko";
import { createSeededRng } from "./rng";
import { SLOT_CONFIGS } from "./slot-configs";
import { spin } from "./slot-engine";
import { STARTING_BALANCE, parseState } from "./store";

describe("arcade engines", () => {
  it("keeps slot results finite and non-negative", () => {
    for (const config of Object.values(SLOT_CONFIGS)) {
      const rng = createSeededRng(42);
      for (let round = 0; round < 500; round += 1) {
        const result = spin(config, 100, rng);
        assert.ok(Number.isFinite(result.payout));
        assert.ok(result.payout >= 0);
      }
    }
  });

  it("creates the requested number of unique mines", () => {
    const field = createMineField(createSeededRng(7), 10);
    assert.equal(field.length, 10);
    assert.equal(new Set(field).size, 10);
    assert.ok(minesMultiplier(3, 4) > 1);
  });

  it("keeps Plinko paths inside the available buckets", () => {
    const outcome = dropBall(createSeededRng(9), 16);
    assert.equal(outcome.path.length, 16);
    assert.ok(outcome.bucket >= 0 && outcome.bucket <= 16);
    assert.equal(plinkoPayouts("alto", 16).length, 17);
  });

  it("recovers safely from malformed local storage", () => {
    const parsed = parseState({ balance: "broken", history: [{ payout: Infinity }] });
    assert.equal(parsed.balance, STARTING_BALANCE);
    assert.equal(parsed.history[0]?.payout, 0);
  });
});
