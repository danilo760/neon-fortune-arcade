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
 */
export function playCandyFeatureSound(name: CandyFeatureSound, enabled: boolean) {
  if (!enabled) return;
  switch (name) {
    case "scatter":
      playSound("candyStreak", true);
      break;
    case "anticipation":
      playSound("anticipation", true);
      playSound("candyBomb", true);
      break;
    case "featureOpen":
      playSound("click", true);
      playSound("candyStreak", true);
      break;
    case "trigger":
      playSound("candyExplosion", true);
      playSound("bonus", true);
      break;
    case "bonusIntro":
      playSound("bonus", true);
      break;
    case "meter":
      playSound("candyBomb", true);
      break;
    case "levelUp":
      playSound("candyStreak", true);
      playSound("win", true);
      break;
    case "retrigger":
      playSound("bonus", true);
      playSound("candyStreak", true);
      break;
    case "bonusEnd":
      playSound("win", true);
      break;
  }
}
