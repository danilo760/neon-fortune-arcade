import assert from "node:assert/strict";
import test from "node:test";

import { goldenTigerAudioPlan } from "./goldenTigerAudio";

test("reel land audio follows left-center-right spatial order", () => {
  const left = goldenTigerAudioPlan({ type: "reel-land", column: 0, featureHint: false });
  const center = goldenTigerAudioPlan({ type: "reel-land", column: 1, featureHint: false });
  const right = goldenTigerAudioPlan({ type: "reel-land", column: 2, featureHint: true });

  assert.equal(left[0]?.name, "tigerReelLand");
  assert.equal(left[0]?.options?.pan, -0.42);
  assert.equal(center[0]?.options?.pan, 0);
  assert.equal(right[0]?.options?.pan, 0.42);
  assert.ok((right[0]?.options?.intensity ?? 0) > (left[0]?.options?.intensity ?? 0));
});

test("feature opening layers a short reveal with the lucky feature accent", () => {
  const cues = goldenTigerAudioPlan({ type: "feature-open" });
  assert.deepEqual(cues.map((cue) => cue.name), ["tigerFeatureOpen", "tigerLuckyFeature"]);
});

test("feature lock grows with progress and only adds impact for Wild/full grid", () => {
  const early = goldenTigerAudioPlan({
    type: "feature-lock",
    lockedCount: 2,
    addedWild: false,
    fullGrid: false,
  });
  const late = goldenTigerAudioPlan({
    type: "feature-lock",
    lockedCount: 8,
    addedWild: true,
    fullGrid: false,
  });

  assert.equal(early.length, 1);
  assert.equal(early[0]?.name, "tigerSymbolLock");
  assert.equal(late.length, 2);
  assert.equal(late[1]?.name, "tigerImpact");
  assert.ok((late[0]?.options?.pitch ?? 0) > (early[0]?.options?.pitch ?? 0));
});

test("full-grid lock gets the strongest impact cue", () => {
  const cues = goldenTigerAudioPlan({
    type: "feature-lock",
    lockedCount: 9,
    addedWild: false,
    fullGrid: true,
  });
  const impact = cues.find((cue) => cue.name === "tigerImpact");
  assert.equal(impact?.options?.intensity, 1.1);
});

test("win tiers keep small/nice local and big/mega on the large win cue", () => {
  assert.equal(goldenTigerAudioPlan({ type: "win", tier: "small" })[0]?.name, "tigerWinAccent");
  assert.equal(goldenTigerAudioPlan({ type: "win", tier: "nice" })[0]?.name, "tigerWinAccent");
  assert.equal(goldenTigerAudioPlan({ type: "win", tier: "big" })[0]?.name, "bigWin");
  assert.equal(goldenTigerAudioPlan({ type: "win", tier: "mega" })[0]?.name, "bigWin");
});
