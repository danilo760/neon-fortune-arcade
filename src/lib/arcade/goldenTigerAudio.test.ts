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
  assert.equal(right[1]?.name, "tigerReveal");
  assert.ok((right[1]?.delayMs ?? 0) > 0);
});

test("feature opening is scored as a staged three-layer cue", () => {
  const cues = goldenTigerAudioPlan({ type: "feature-open" });
  assert.deepEqual(cues.map((cue) => cue.name), ["tigerFeatureOpen", "tigerLuckyFeature", "tigerFeatureStart"]);
  assert.equal(cues[0]?.delayMs, undefined);
  assert.ok((cues[1]?.delayMs ?? 0) < (cues[2]?.delayMs ?? 0));
});

test("late respins add controlled anticipation without changing the outcome layer", () => {
  const early = goldenTigerAudioPlan({ type: "feature-respin", attempt: 1, lockedCount: 2 });
  const late = goldenTigerAudioPlan({ type: "feature-respin", attempt: 3, lockedCount: 7 });

  assert.equal(early.length, 1);
  assert.equal(early[0]?.name, "tigerRespinRoll");
  assert.equal(late[0]?.name, "tigerRespinRoll");
  assert.equal(late[1]?.name, "anticipation");
  assert.ok((late[0]?.options?.pitch ?? 0) > (early[0]?.options?.pitch ?? 0));
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

  assert.deepEqual(early.map((cue) => cue.name), ["tigerSymbolLock", "tigerCardAppear"]);
  assert.equal(late[2]?.name, "tigerImpact");
  assert.ok((late[0]?.options?.pitch ?? 0) > (early[0]?.options?.pitch ?? 0));
  assert.ok((early[1]?.delayMs ?? 0) > 0);
});

test("full-grid lock and celebration keep the strongest impact/reward layers", () => {
  const lock = goldenTigerAudioPlan({
    type: "feature-lock",
    lockedCount: 9,
    addedWild: false,
    fullGrid: true,
  });
  const impact = lock.find((cue) => cue.name === "tigerImpact");
  assert.equal(impact?.options?.intensity, 1.12);

  const celebration = goldenTigerAudioPlan({ type: "full-grid" });
  assert.deepEqual(celebration.map((cue) => cue.name), ["tigerFullGrid", "bigWin"]);
  assert.ok((celebration[1]?.delayMs ?? 0) > 0);
});

test("win tiers keep small/nice local and layer character accent on large wins", () => {
  const small = goldenTigerAudioPlan({ type: "win", tier: "small" });
  const nice = goldenTigerAudioPlan({ type: "win", tier: "nice" });
  const big = goldenTigerAudioPlan({ type: "win", tier: "big" });
  const mega = goldenTigerAudioPlan({ type: "win", tier: "mega" });
  const superMega = goldenTigerAudioPlan({ type: "win", tier: "super" });

  assert.equal(small[0]?.name, "tigerWinAccent");
  assert.equal(nice[0]?.name, "tigerWinAccent");
  assert.deepEqual(big.map((cue) => cue.name), ["bigWin", "tigerWinAccent"]);
  assert.deepEqual(mega.map((cue) => cue.name), ["bigWin", "tigerWinAccent"]);
  assert.deepEqual(superMega.map((cue) => cue.name), ["bigWin", "tigerWinAccent"]);
  assert.ok((superMega[0]?.options?.intensity ?? 0) > (mega[0]?.options?.intensity ?? 0));
});
