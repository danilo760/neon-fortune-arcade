import {
  playSound,
  type SoundName,
  type SoundOptions,
} from "./sound";

export type GoldenTigerAudioWinTier = "small" | "nice" | "big" | "mega";

export type GoldenTigerAudioEvent =
  | { type: "spin" }
  | { type: "reel-land"; column: number; featureHint: boolean }
  | { type: "anticipation" }
  | { type: "feature-open" }
  | { type: "feature-respin"; attempt: number; lockedCount: number }
  | { type: "feature-lock"; lockedCount: number; addedWild: boolean; fullGrid: boolean }
  | { type: "feature-miss" }
  | { type: "reveal"; winMultiple: number }
  | { type: "win"; tier: GoldenTigerAudioWinTier }
  | { type: "full-grid" }
  | { type: "lose" }
  | { type: "click" };

export type GoldenTigerAudioCue = {
  name: SoundName;
  options?: SoundOptions;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Pure cue planner for the Golden Tiger presentation.
 *
 * This does not encode gameplay probabilities or outcomes. It only converts
 * already-decided visual/game states into a compact audio score so reel stops,
 * feature locks and wins stay synchronized from one place.
 */
export function goldenTigerAudioPlan(event: GoldenTigerAudioEvent): GoldenTigerAudioCue[] {
  switch (event.type) {
    case "spin":
      return [{ name: "spin", options: { intensity: 0.92 } }];

    case "reel-land": {
      const column = Math.max(0, Math.min(2, Math.trunc(event.column)));
      return [{
        name: "tigerReelLand",
        options: {
          pan: column === 0 ? -0.42 : column === 2 ? 0.42 : 0,
          intensity: event.featureHint && column === 2 ? 1.03 : 0.84,
          pitch: 0.98 + column * 0.035,
        },
      }];
    }

    case "anticipation":
      return [{ name: "anticipation", options: { intensity: 0.8, pitch: 1.02 } }];

    case "feature-open":
      return [
        { name: "tigerFeatureOpen", options: { intensity: 1.02 } },
        { name: "tigerLuckyFeature", options: { intensity: 0.72, pitch: 1.01 } },
      ];

    case "feature-respin": {
      const attempt = clamp(Math.trunc(event.attempt), 1, 12);
      const locked = clamp(Math.trunc(event.lockedCount), 0, 9);
      return [{
        name: "tigerRespinRoll",
        options: {
          intensity: clamp(0.82 + locked * 0.025, 0.82, 1.04),
          pitch: clamp(0.98 + attempt * 0.012 + locked * 0.004, 0.98, 1.12),
        },
      }];
    }

    case "feature-lock": {
      const locked = clamp(Math.trunc(event.lockedCount), 1, 9);
      const cues: GoldenTigerAudioCue[] = [{
        name: "tigerSymbolLock",
        options: {
          intensity: clamp(0.88 + locked * 0.018, 0.9, 1.06),
          pitch: clamp(0.98 + locked * 0.012, 0.99, 1.09),
        },
      }];
      if (event.addedWild || event.fullGrid) {
        cues.push({
          name: "tigerImpact",
          options: {
            intensity: event.fullGrid ? 1.1 : 1.02,
            pitch: event.fullGrid ? 0.96 : 1.02,
          },
        });
      }
      return cues;
    }

    case "feature-miss":
      return [{ name: "tigerMiss", options: { intensity: 0.88 } }];

    case "reveal":
      return [{
        name: "tigerReveal",
        options: {
          intensity: event.winMultiple >= 5 ? 1.04 : 0.86,
          pitch: event.winMultiple >= 10 ? 1.04 : 1,
        },
      }];

    case "win":
      if (event.tier === "big" || event.tier === "mega") {
        return [{
          name: "bigWin",
          options: { intensity: event.tier === "mega" ? 1.12 : 1.02 },
        }];
      }
      return [{
        name: "tigerWinAccent",
        options: {
          intensity: event.tier === "nice" ? 1.04 : 0.9,
          pitch: event.tier === "nice" ? 1.06 : 1,
        },
      }];

    case "full-grid":
      return [{ name: "tigerFullGrid", options: { intensity: 1.1, pitch: 0.98 } }];

    case "lose":
      return [{ name: "lose", options: { intensity: 0.78 } }];

    case "click":
      return [{ name: "click", options: { intensity: 0.84 } }];
  }
}

export function playGoldenTigerAudio(event: GoldenTigerAudioEvent, enabled: boolean) {
  if (!enabled) return;
  for (const cue of goldenTigerAudioPlan(event)) {
    playSound(cue.name, true, cue.options);
  }
}
