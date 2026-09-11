import assert from "node:assert/strict";
import test from "node:test";

import { animatedWinCounterProgress } from "./AnimatedWinCounter";

test("front-load-80 reaches 80% early and reserves the final fifth for a slow finish", () => {
  assert.equal(animatedWinCounterProgress(0, "front-load-80"), 0);
  assert.ok(Math.abs(animatedWinCounterProgress(0.24, "front-load-80") - 0.8) < 0.000001);
  assert.ok(animatedWinCounterProgress(0.5, "front-load-80") > 0.92);
  assert.ok(animatedWinCounterProgress(0.8, "front-load-80") < 0.995);
  assert.equal(animatedWinCounterProgress(1, "front-load-80"), 1);
});

test("standard curve remains available for the other games", () => {
  const atQuarter = animatedWinCounterProgress(0.25, "standard");
  assert.ok(atQuarter > 0.5 && atQuarter < 0.7);
  assert.equal(animatedWinCounterProgress(1, "standard"), 1);
});
