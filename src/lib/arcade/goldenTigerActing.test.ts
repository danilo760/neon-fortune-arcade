import assert from "node:assert/strict";
import test from "node:test";
import { goldenTigerPose, type TigerReactionState } from "./goldenTigerActing";

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
