import assert from "node:assert/strict";
import test from "node:test";

import {
  goldenTigerAnticipationMs,
  goldenTigerAutoGapMs,
  goldenTigerBrakeEase,
  goldenTigerNominalSpinMs,
  goldenTigerReelBrakeMs,
  goldenTigerReelLandPauseMs,
  goldenTigerRevealPauseMs,
} from "./goldenTigerMotion";

test("Golden Tiger reel brakes get slightly longer from left to right", () => {
  assert.ok(goldenTigerReelBrakeMs(0, false) < goldenTigerReelBrakeMs(1, false));
  assert.ok(goldenTigerReelBrakeMs(1, false) < goldenTigerReelBrakeMs(2, false));
  assert.ok(goldenTigerReelBrakeMs(0, true) < goldenTigerReelBrakeMs(2, true));
});

test("Golden Tiger normal spin has readable commercial weight while Turbo preserves choreography", () => {
  const normal = goldenTigerNominalSpinMs(false, true);
  const turbo = goldenTigerNominalSpinMs(true, true);
  assert.ok(normal >= 3200 && normal <= 3350, `normal=${normal}`);
  assert.ok(turbo >= 880 && turbo <= 930, `turbo=${turbo}`);
  assert.ok(normal > turbo * 3.4, `normal=${normal} turbo=${turbo}`);
});

test("anticipation is a real hold in normal mode and remains readable in Turbo", () => {
  assert.ok(goldenTigerAnticipationMs(false) >= 450);
  assert.ok(goldenTigerAnticipationMs(false) > goldenTigerReelLandPauseMs(2, false) * 2);
  assert.ok(goldenTigerAnticipationMs(true) >= 120 && goldenTigerAnticipationMs(true) <= 140);
});

test("result and Auto gaps preserve breathing room without making Turbo feel instant", () => {
  assert.ok(goldenTigerRevealPauseMs(false, true) > goldenTigerRevealPauseMs(false, false));
  assert.ok(goldenTigerRevealPauseMs(true, true) >= 100);
  assert.ok(goldenTigerAutoGapMs(false) >= 350);
  assert.ok(goldenTigerAutoGapMs(true) >= 120);
});

test("Golden Tiger brake easing is clamped, monotonic and ends exactly on the snap target", () => {
  const samples = [-1, 0, 0.2, 0.5, 0.8, 1, 2].map(goldenTigerBrakeEase);
  assert.equal(samples[0], 0);
  assert.equal(samples.at(-1), 1);
  for (let index = 1; index < samples.length; index += 1) {
    assert.ok((samples[index] ?? 0) >= (samples[index - 1] ?? 0));
  }
});
