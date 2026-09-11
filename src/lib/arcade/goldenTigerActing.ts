export type TigerReactionState = "idle" | "watch" | "reveal" | "feature" | "tense" | "win" | "full";
export type TigerPose = TigerReactionState | "blink";

/** Keep authored acting on the same timeline as reels, particles and audio. */
export function goldenTigerPose(reaction: TigerReactionState, idleBlink: boolean): TigerPose {
  return reaction === "idle" && idleBlink ? "blink" : reaction;
}

/**
 * Pose artwork is discrete, but the actor should not visibly pop between atlas
 * cells. These short overlaps are presentation-only and remain quicker than
 * the game events that select each pose, while avoiding flash-like swaps.
 */
export function goldenTigerPoseTransitionMs(from: TigerPose, to: TigerPose, reduceMotion = false) {
  if (reduceMotion || from === to) return 0;
  if (from === "blink" || to === "blink") return 130;
  if (to === "full") return 360;
  if (to === "win" || to === "feature") return 320;
  if (to === "tense" || to === "reveal") return 285;
  return 240;
}
