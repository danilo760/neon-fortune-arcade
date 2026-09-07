import { playSound } from "../sound";
import type { GoldenTigerWinTier } from "./goldenTigerConfig";

function isLargeWin(tier: GoldenTigerWinTier) {
  return tier === "big" || tier === "mega" || tier === "epic";
}

/**
 * Golden Tiger audio adapter.
 *
 * Uses the shared procedural WebAudio engine instead of remote samples so the
 * game has deterministic, low-latency, original cues with no network fetches.
 */
export const goldenTigerAudio = {
  buttonClick(enabled: boolean) {
    playSound("click", enabled);
  },

  spinStart(enabled: boolean) {
    playSound("spin", enabled);
  },

  reelLanding(_column: number, enabled: boolean) {
    playSound("tick", enabled);
  },

  anticipationLoop(enabled: boolean) {
    playSound("anticipation", enabled);
  },

  respinTrigger(enabled: boolean) {
    playSound("tigerLuckyFeature", enabled);
  },

  symbolLock(enabled: boolean) {
    playSound("tigerSymbolLock", enabled);
  },

  respinMiss(enabled: boolean) {
    playSound("tigerMiss", enabled);
  },

  lineHit(enabled: boolean) {
    playSound("cash", enabled);
  },

  win(tier: GoldenTigerWinTier, enabled: boolean) {
    if (tier === "none") return;
    playSound(isLargeWin(tier) ? "bigWin" : "win", enabled);
  },

  fullGrid(enabled: boolean) {
    playSound("tigerFullGrid", enabled);
  },
};
