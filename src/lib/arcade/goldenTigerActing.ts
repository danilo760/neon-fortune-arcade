export type TigerReactionState = "idle" | "watch" | "reveal" | "feature" | "tense" | "win" | "full";
export type TigerPose = TigerReactionState | "blink";

/** Keep authored acting on the same timeline as reels, particles and audio. */
export function goldenTigerPose(reaction: TigerReactionState, idleBlink: boolean): TigerPose {
  return reaction === "idle" && idleBlink ? "blink" : reaction;
}
