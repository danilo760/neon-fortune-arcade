import {
  playSound,
  type SoundName,
  type SoundOptions,
} from "./sound";
import { playGoldenTigerSample } from "./goldenTigerSamples";

export type GoldenTigerAudioWinTier = "small" | "nice" | "big" | "mega" | "super";

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
  /** Small score offset so layered cues read as one authored beat, not a chord dump. */
  delayMs?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/** Gameplay decides every result before this score runs. Samples only replace
 * the primary presentation hit; secondary procedural accents remain layered. */
export function goldenTigerAudioPlan(event: GoldenTigerAudioEvent): GoldenTigerAudioCue[] {
  switch (event.type) {
    case "spin":
      return [
        { name: "spin", options: { intensity: 0.9, pitch: 0.99 } },
        { name: "tigerRespinRoll", options: { intensity: 0.42, pitch: 0.9 }, delayMs: 72 },
      ];

    case "reel-land": {
      const column = Math.max(0, Math.min(2, Math.trunc(event.column)));
      const cues: GoldenTigerAudioCue[] = [{
        name: "tigerReelLand",
        options: {
          pan: column === 0 ? -0.42 : column === 2 ? 0.42 : 0,
          intensity: event.featureHint && column === 2 ? 1.04 : 0.84 + column * 0.035,
          pitch: 0.97 + column * 0.04,
        },
      }];
      if (event.featureHint && column === 2) {
        cues.push({ name: "tigerReveal", options: { intensity: 0.52, pitch: 1.05 }, delayMs: 52 });
      }
      return cues;
    }

    case "anticipation":
      return [
        { name: "anticipation", options: { intensity: 0.82, pitch: 0.98 } },
        { name: "tigerLuckyFeature", options: { intensity: 0.38, pitch: 0.94 }, delayMs: 108 },
      ];

    case "feature-open":
      return [
        { name: "tigerFeatureOpen", options: { intensity: 1.02 } },
        { name: "tigerLuckyFeature", options: { intensity: 0.72, pitch: 1.01 }, delayMs: 72 },
        { name: "tigerFeatureStart", options: { intensity: 0.66, pitch: 0.99 }, delayMs: 182 },
      ];

    case "feature-respin": {
      const attempt = clamp(Math.trunc(event.attempt), 1, 12);
      const locked = clamp(Math.trunc(event.lockedCount), 0, 9);
      const cues: GoldenTigerAudioCue[] = [{
        name: "tigerRespinRoll",
        options: {
          intensity: clamp(0.8 + locked * 0.026, 0.8, 1.04),
          pitch: clamp(0.965 + attempt * 0.013 + locked * 0.005, 0.97, 1.12),
        },
      }];
      if (locked >= 5) {
        cues.push({
          name: "anticipation",
          options: {
            intensity: clamp(0.28 + locked * 0.035, 0.42, 0.62),
            pitch: clamp(0.94 + locked * 0.012, 0.98, 1.05),
          },
          delayMs: 62,
        });
      }
      return cues;
    }

    case "feature-lock": {
      const locked = clamp(Math.trunc(event.lockedCount), 1, 9);
      const cues: GoldenTigerAudioCue[] = [
        {
          name: "tigerSymbolLock",
          options: {
            intensity: clamp(0.86 + locked * 0.021, 0.9, 1.07),
            pitch: clamp(0.97 + locked * 0.014, 0.99, 1.1),
          },
        },
        {
          name: "tigerCardAppear",
          options: {
            intensity: clamp(0.34 + locked * 0.025, 0.38, 0.58),
            pitch: clamp(0.95 + locked * 0.011, 0.97, 1.05),
          },
          delayMs: 36,
        },
      ];
      if (event.addedWild || event.fullGrid) {
        cues.push({
          name: "tigerImpact",
          options: {
            intensity: event.fullGrid ? 1.12 : 1.02,
            pitch: event.fullGrid ? 0.95 : 1.02,
          },
          delayMs: event.fullGrid ? 54 : 44,
        });
      }
      return cues;
    }

    case "feature-miss":
      return [{ name: "tigerMiss", options: { intensity: 0.84, pitch: 0.98 } }];

    case "reveal":
      return [{
        name: "tigerReveal",
        options: {
          intensity: event.winMultiple >= 5 ? 1.04 : 0.86,
          pitch: event.winMultiple >= 10 ? 1.04 : 1,
        },
      }];

    case "win":
      if (event.tier === "big" || event.tier === "mega" || event.tier === "super") {
        return [
          {
            name: "bigWin",
            options: { intensity: event.tier === "super" ? 1.16 : event.tier === "mega" ? 1.12 : 1.02 },
          },
          {
            name: "tigerWinAccent",
            options: { intensity: event.tier === "super" ? 0.72 : 0.6, pitch: event.tier === "super" ? 1.08 : 1.04 },
            delayMs: 88,
          },
        ];
      }
      return [{
        name: "tigerWinAccent",
        options: {
          intensity: event.tier === "nice" ? 1.04 : 0.9,
          pitch: event.tier === "nice" ? 1.06 : 1,
        },
      }];

    case "full-grid":
      return [
        { name: "tigerFullGrid", options: { intensity: 1.12, pitch: 0.97 } },
        { name: "bigWin", options: { intensity: 0.9, pitch: 1.03 }, delayMs: 96 },
      ];

    case "lose":
      return [{ name: "lose", options: { intensity: 0.74 } }];

    case "click":
      return [{ name: "click", options: { intensity: 0.84 } }];
  }
}

const delayedGoldenTigerAudio = new Set<ReturnType<typeof globalThis.setTimeout>>();

function eventSampleStarted(event: GoldenTigerAudioEvent, enabled: boolean) {
  switch (event.type) {
    case "spin": return playGoldenTigerSample({ type: "spin" }, enabled);
    case "reel-land": return playGoldenTigerSample({ type: "reel-land", column: event.column }, enabled);
    case "anticipation": return playGoldenTigerSample({ type: "anticipation" }, enabled);
    case "feature-lock": return playGoldenTigerSample({ type: "feature-lock" }, enabled);
    case "win": return playGoldenTigerSample({ type: "win", tier: event.tier }, enabled);
    case "full-grid": return playGoldenTigerSample({ type: "full-grid" }, enabled);
    default: return false;
  }
}

export function playGoldenTigerAudio(event: GoldenTigerAudioEvent, enabled: boolean) {
  if (!enabled) return;
  const sampleStarted = eventSampleStarted(event, enabled);
  const cues = goldenTigerAudioPlan(event);
  const startAt = sampleStarted ? 1 : 0;
  for (let index = startAt; index < cues.length; index += 1) {
    const cue = cues[index];
    if (!cue) continue;
    const play = () => playSound(cue.name, true, cue.options);
    if ((cue.delayMs ?? 0) > 0) {
      const id = globalThis.setTimeout(() => {
        delayedGoldenTigerAudio.delete(id);
        play();
      }, cue.delayMs);
      delayedGoldenTigerAudio.add(id);
    } else play();
  }
}

export function disposeGoldenTigerAudio() {
  for (const id of delayedGoldenTigerAudio) globalThis.clearTimeout(id);
  delayedGoldenTigerAudio.clear();
}
