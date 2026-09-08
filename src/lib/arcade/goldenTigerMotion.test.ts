import assert from "node:assert/strict";
import test from "node:test";

import {
  goldenTigerBrakeEase,
  goldenTigerNominalSpinMs,
  goldenTigerReelBrakeMs,
} from "./goldenTigerMotion";

test("Golden Tiger reel brakes get slightly longer from left to right", () => {
  assert.ok(goldenTigerReelBrakeMs(0, false) < goldenTigerReelBrakeMs(1, false));
  assert.ok(goldenTigerReelBrakeMs(1, false) < goldenTigerReelBrakeMs(2, false));
  assert.ok(goldenTigerReelBrakeMs(0, true) < goldenTigerReelBrakeMs(2, true));
});

test("Golden Tiger nominal spin pacing stays inside the reference-derived targets", () => {
  const normal = goldenTigerNominalSpinMs(false, true);
  const turbo = goldenTigerNominalSpinMs(true, true);
  assert.ok(normal >= 900 && normal <= 1350, `normal=${normal}`);
  assert.ok(turbo >= 350 && turbo <= 550, `turbo=${turbo}`);
});

test("Golden Tiger brake easing is clamped, monotonic and ends exactly on the snap target", () => {
  const samples = [-1, 0, 0.2, 0.5, 0.8, 1, 2].map(goldenTigerBrakeEase);
  assert.equal(samples[0], 0);
  assert.equal(samples.at(-1), 1);
  for (let index = 1; index < samples.length; index += 1) {
    assert.ok((samples[index] ?? 0) >= (samples[index - 1] ?? 0));
  }
});
