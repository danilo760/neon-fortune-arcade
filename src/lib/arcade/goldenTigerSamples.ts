import { playGoldenTigerAuthoredCue, startGoldenTigerAuthoredScore } from "./goldenTigerScore";

export type GoldenTigerSampleEvent =
  | { type: "spin" }
  | { type: "reel-land"; column: number }
  | { type: "anticipation" }
  | { type: "feature-lock" }
  | { type: "win"; tier: string }
  | { type: "full-grid" };

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
      return playGoldenTigerAuthoredCue("reel-stop", enabled, {
        column,
        intensity: .93 + column * .055,
        pan: column === 0 ? -.38 : column === 2 ? .38 : 0,
      });
    }
    case "anticipation":
      return playGoldenTigerAuthoredCue("anticipation", enabled, { intensity: .94 });
    case "feature-lock":
      return playGoldenTigerAuthoredCue("sticky-land", enabled, { intensity: .98 });
    case "win":
      if (event.tier === "small") return playGoldenTigerAuthoredCue("small-win", enabled, { intensity: .9 });
      if (event.tier === "nice") return playGoldenTigerAuthoredCue("win", enabled, { intensity: .96 });
      return playGoldenTigerAuthoredCue("big-win", enabled, {
        intensity: event.tier === "super" ? 1.18 : event.tier === "mega" ? 1.1 : 1.04,
      });
    case "full-grid":
      return playGoldenTigerAuthoredCue("full-grid", enabled, { intensity: 1.18 });
  }
}
