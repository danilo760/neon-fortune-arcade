import { playArcadeSample, preloadArcadeSamples } from "./sound";

export type GoldenTigerSampleEvent =
  | { type: "spin" }
  | { type: "reel-land"; column: number }
  | { type: "anticipation" }
  | { type: "feature-lock" }
  | { type: "win"; tier: string }
  | { type: "full-grid" };

const SAMPLE_URLS = {
  spin: "/audio/golden-tiger/spin-start.ogg",
  reel1: "/audio/golden-tiger/reel-stop-1.ogg",
  reel2: "/audio/golden-tiger/reel-stop-2.ogg",
  reel3: "/audio/golden-tiger/reel-stop-3.ogg",
  anticipation: "/audio/golden-tiger/anticipation.ogg",
  lock: "/audio/golden-tiger/symbol-lock.ogg",
  bigWin: "/audio/golden-tiger/big-win-stinger.ogg",
  coin: "/audio/golden-tiger/coin-drop.ogg",
} as const;

export function preloadGoldenTigerSamples() {
  return preloadArcadeSamples(Object.values(SAMPLE_URLS));
}

/** Returns true only when a decoded sample was already available and started.
 * If a commissioned sample pack is absent, the procedural cue remains the
 * deterministic fallback without blocking gameplay. */
export function playGoldenTigerSample(event: GoldenTigerSampleEvent, enabled: boolean) {
  if (!enabled) return false;
  switch (event.type) {
    case "spin":
      return playArcadeSample(SAMPLE_URLS.spin, { bus: "game", intensity: .86, randomPitchPercent: .05 });
    case "reel-land":
      return playArcadeSample(
        event.column === 0 ? SAMPLE_URLS.reel1 : event.column === 1 ? SAMPLE_URLS.reel2 : SAMPLE_URLS.reel3,
        { bus: "impact", intensity: .92, pan: event.column === 0 ? -.4 : event.column === 2 ? .4 : 0, randomPitchPercent: .05 },
      );
    case "anticipation":
      return playArcadeSample(SAMPLE_URLS.anticipation, { bus: "game", intensity: .9 });
    case "feature-lock": {
      const played = playArcadeSample(SAMPLE_URLS.lock, { bus: "impact", intensity: .9, randomPitchPercent: .035 });
      void playArcadeSample(SAMPLE_URLS.coin, { bus: "reward", intensity: .48, randomPitchPercent: .05 });
      return played;
    }
    case "win":
      if (event.tier !== "big" && event.tier !== "mega" && event.tier !== "super") return false;
      return playArcadeSample(SAMPLE_URLS.bigWin, { bus: "impact", intensity: event.tier === "super" ? 1.12 : 1.02 });
    case "full-grid":
      return playArcadeSample(SAMPLE_URLS.bigWin, { bus: "impact", intensity: 1.14, pitch: .98 });
  }
}
