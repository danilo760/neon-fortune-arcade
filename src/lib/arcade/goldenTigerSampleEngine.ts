import { stopGoldenTigerAnticipationRiser } from "./goldenTigerAnticipationRiser";
import { stopGoldenTigerAuthoredScore } from "./goldenTigerScore";

export type GoldenTigerSampleBus = "game" | "impact" | "reward";
export type GoldenTigerSampleOptions = {
  bus?: GoldenTigerSampleBus;
  pan?: number;
  intensity?: number;
  pitch?: number;
  randomPitchPercent?: number;
};

/**
 * Compatibility shim retained for callers from Session 2. Session 3 no longer
 * depends on missing public/audio files: the dedicated authored Neon score in
 * goldenTigerScore.ts owns music, reel texture and premium transients.
 */
export async function preloadGoldenTigerSampleUrls(_urls: readonly string[]) {
  // Intentionally no-op.
}

export function playGoldenTigerSampleUrl(_url: string, _options: GoldenTigerSampleOptions = {}) {
  return false;
}

export function disposeGoldenTigerSampleEngine() {
  stopGoldenTigerAnticipationRiser(false, false);
  stopGoldenTigerAuthoredScore();
}
