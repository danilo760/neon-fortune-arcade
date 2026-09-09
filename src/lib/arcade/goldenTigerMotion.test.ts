import assert from "node:assert/strict";
import test from "node:test";

import {
  goldenTigerAnticipationMs,
  goldenTigerBrakeEase,
  goldenTigerNominalSpinMs,
  goldenTigerReelBrakeMs,
  goldenTigerReelLandPauseMs,
} from "./goldenTigerMotion";

test("Golden Tiger reel brakes get slightly longer from left to right", () => {
  assert.ok(goldenTigerReelBrakeMs(0, false) < goldenTigerReelBrakeMs(1, false));
  assert.ok(goldenTigerReelBrakeMs(1, false) < goldenTigerReelBrakeMs(2, false));
  assert.ok(goldenTigerReelBrakeMs(0, true) < goldenTigerReelBrakeMs(2, true));
});

test("Golden Tiger normal spin has readable reel weight while Turbo stays quick", () => {
  const normal = goldenTigerNominalSpinMs(false, true);
  const turbo = goldenTigerNominalSpinMs(true, true);
  assert.ok(normal >= 1400 && normal <= 1580, `normal=${normal}`);
  assert.ok(turbo >= 400 && turbo <= 500, `turbo=${turbo}`);
  assert.ok(normal > turbo * 3, `normal=${normal} turbo=${turbo}`);
});

test("anticipation is a deliberate beat in normal mode without stalling Turbo", () => {
  assert.ok(goldenTigerAnticipationMs(false) >= 180);
  assert.ok(goldenTigerAnticipationMs(false) > goldenTigerReelLandPauseMs(2, false) * 2);
  assert.ok(goldenTigerAnticipationMs(true) < 60);
});

test("Golden Tiger brake easing is clamped, monotonic and ends exactly on the snap target", () => {
  const samples = [-1, 0, 0.2, 0.5, 0.8, 1, 2].map(goldenTigerBrakeEase);
  assert.equal(samples[0], 0);
  assert.equal(samples.at(-1), 1);
  for (let index = 1; index < samples.length; index += 1) {
    assert.ok((samples[index] ?? 0) >= (samples[index - 1] ?? 0));
  }
});
