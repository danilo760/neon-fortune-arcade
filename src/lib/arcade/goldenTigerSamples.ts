import { playGoldenTigerAuthoredCue, startGoldenTigerAuthoredScore } from "./goldenTigerScore";

export type GoldenTigerSampleEvent =
  | { type: "spin" }
  | { type: "reel-land"; column: number }
  | { type: "anticipation" }
  | { type: "feature-open" }
  | { type: "feature-lock" }
  | { type: "win"; tier: string }
  | { type: "full-grid" }
  | { type: "click" };

/**
 * Session 3 keeps this compatibility boundary because the higher-level audio
 * director already calls it. The implementation is now an authored Neon score
 * rather than a collection of missing sample URLs. The old procedural cue
 * generator remains a safety fallback when Web Audio is not ready.
 */
export async function preloadGoldenTigerSamples() {
  // Nothing to fetch: the authored score is deterministic and code-owned.
}

export function playGoldenTigerSample(event: GoldenTigerSampleEvent, enabled: boolean) {
  if (!enabled) return false;

  switch (event.type) {
    case "spin": {
      startGoldenTigerAuthoredScore(enabled);
      const primary = playGoldenTigerAuthoredCue("spin", enabled, { intensity: .94 });
      playGoldenTigerAuthoredCue("reel-loop", enabled, { intensity: .74 });
      return primary;
    }
    case "reel-land": {
      const column = Math.max(0, Math.min(2, Math.trunc(event.column)));
      const pan = column === 0 ? -.42 : column === 2 ? .42 : 0;
      const primary = playGoldenTigerAuthoredCue("reel-stop", enabled, {
        column,
        intensity: .9 + column * .05,
        pan,
      });
      playGoldenTigerAuthoredCue("symbol-land", enabled, {
        column,
        intensity: .42 + column * .025,
        pan: pan * .72,
      });
      return primary;
    }
    case "anticipation": {
      const primary = playGoldenTigerAuthoredCue("anticipation", enabled, { intensity: .92 });
      playGoldenTigerAuthoredCue("reel-loop", enabled, { intensity: .28 });
      return primary;
    }
    case "feature-open":
      return playGoldenTigerAuthoredCue("feature-trigger", enabled, { intensity: 1.05 });
    case "feature-lock": {
      const primary = playGoldenTigerAuthoredCue("sticky-land", enabled, { intensity: .96 });
      playGoldenTigerAuthoredCue("symbol-land", enabled, { intensity: .5 });
      return primary;
    }
    case "win": {
      if (event.tier === "small") {
        const primary = playGoldenTigerAuthoredCue("small-win", enabled, { intensity: .86 });
        playGoldenTigerAuthoredCue("symbol-land", enabled, { intensity: .28 });
        return primary;
      }
      if (event.tier === "nice") {
        const primary = playGoldenTigerAuthoredCue("win", enabled, { intensity: .94 });
        playGoldenTigerAuthoredCue("small-win", enabled, { intensity: .34 });
        return primary;
      }
      const primary = playGoldenTigerAuthoredCue("big-win", enabled, {
        intensity: event.tier === "super" ? 1.16 : event.tier === "mega" ? 1.09 : 1.02,
      });
      playGoldenTigerAuthoredCue("win", enabled, { intensity: event.tier === "super" ? .58 : .46 });
      return primary;
    }
    case "full-grid": {
      const primary = playGoldenTigerAuthoredCue("full-grid", enabled, { intensity: 1.16 });
      playGoldenTigerAuthoredCue("big-win", enabled, { intensity: .64 });
      return primary;
    }
    case "click":
      return playGoldenTigerAuthoredCue("button", enabled, { intensity: .82 });
  }
}
