export type TigerReactionState = "idle" | "watch" | "reveal" | "feature" | "tense" | "win" | "full";
export type TigerPose = TigerReactionState | "blink";

/** Keep authored acting on the same timeline as reels, particles and audio. */
export function goldenTigerPose(reaction: TigerReactionState, idleBlink: boolean): TigerPose {
  return reaction === "idle" && idleBlink ? "blink" : reaction;
}

/**
 * Pose artwork is discrete, but the actor should not visibly pop between atlas
 * cells. These short overlaps are presentation-only and are intentionally much
 * faster than the game events that select each pose.
 */
export function goldenTigerPoseTransitionMs(from: TigerPose, to: TigerPose, reduceMotion = false) {
  if (reduceMotion || from === to) return 0;
  if (from === "blink" || to === "blink") return 92;
  if (to === "full") return 220;
  if (to === "win" || to === "feature") return 185;
  if (to === "tense" || to === "reveal") return 165;
  return 150;
}
