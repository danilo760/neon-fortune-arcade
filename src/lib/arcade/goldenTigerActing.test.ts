import assert from "node:assert/strict";
import test from "node:test";
import {
  goldenTigerPose,
  goldenTigerPoseTransitionMs,
  type TigerReactionState,
} from "./goldenTigerActing";

test("all active poses follow game events even if an idle blink was pending", () => {
  const states: TigerReactionState[] = ["watch", "tense", "reveal", "feature", "win", "full"];
  for (const state of states) {
    assert.equal(goldenTigerPose(state, false), state);
    assert.equal(goldenTigerPose(state, true), state);
  }
});

test("the eighth pose is reserved for idle blinking", () => {
  assert.equal(goldenTigerPose("idle", false), "idle");
  assert.equal(goldenTigerPose("idle", true), "blink");
});

test("a normal win cannot promote itself to the full-grid pose", () => {
  for (let beat = 0; beat < 12; beat++) assert.equal(goldenTigerPose("win", false), "win");
});

test("pose overlap is brief, deterministic and strongest for full-grid", () => {
  assert.equal(goldenTigerPoseTransitionMs("idle", "idle"), 0);
  assert.ok(goldenTigerPoseTransitionMs("idle", "blink") < 110);
  assert.ok(goldenTigerPoseTransitionMs("watch", "tense") >= 150);
  assert.ok(goldenTigerPoseTransitionMs("reveal", "win") >= 175);
  assert.ok(goldenTigerPoseTransitionMs("win", "full") > goldenTigerPoseTransitionMs("reveal", "win"));
  assert.equal(goldenTigerPoseTransitionMs("watch", "tense", true), 0);
});
