import { playSound } from "./sound";

export type CandyFeatureSound =
  | "scatter"
  | "anticipation"
  | "featureOpen"
  | "trigger"
  | "bonusIntro"
  | "meter"
  | "levelUp"
  | "retrigger"
  | "bonusEnd";

/**
 * Semantic Candy sound layer. It intentionally reuses the shared cached audio
 * engine instead of creating a second AudioContext or unmanaged AudioNodes.
 * Each semantic event owns one primary cue so important moments do not become
 * a stack of simultaneous reward sounds.
 */
export function playCandyFeatureSound(name: CandyFeatureSound, enabled: boolean) {
  if (!enabled) return;
  switch (name) {
    case "scatter":
      playSound("candyStreak", true);
      break;
    case "anticipation":
      playSound("anticipation", true);
      break;
    case "featureOpen":
      playSound("candyStreak", true);
      break;
    case "trigger":
      playSound("candyExplosion", true);
      break;
    case "bonusIntro":
      playSound("bonus", true);
      break;
    case "meter":
      playSound("candyBomb", true);
      break;
    case "levelUp":
      playSound("win", true);
      break;
    case "retrigger":
      playSound("bonus", true);
      break;
    case "bonusEnd":
      playSound("win", true);
      break;
  }
}
