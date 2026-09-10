import { memo, useEffect, useState } from "react";

import tigerPoseAtlas from "@/assets/golden-tiger/tiger-pose-atlas.webp";

export type TigerReactionState = "idle" | "watch" | "reveal" | "feature" | "tense" | "win" | "full";
type TigerPose = TigerReactionState | "blink";

type Props = {
  reaction: TigerReactionState;
  featureActive: boolean;
  lockedCount: number;
};

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function actingPose(reaction: TigerReactionState, beat: number): TigerPose {
  if (reaction === "watch") return beat % 4 === 3 ? "tense" : "watch";
  if (reaction === "reveal") return beat % 2 === 0 ? "reveal" : "tense";
  if (reaction === "tense") return beat % 3 === 1 ? "reveal" : "tense";
  if (reaction === "feature") return beat % 3 === 2 ? "reveal" : "feature";
  if (reaction === "win") return beat % 3 === 1 ? "full" : "win";
  if (reaction === "full") return beat % 2 === 0 ? "full" : "win";
  return reaction;
}

/**
 * Presentation-only mascot stage using an original 4×2 pose atlas.
 *
 * Pose order: idle, blink, watch, tense / reveal, feature, win, full.
 * Besides idle blinks, active states now sequence authored poses so the tiger
 * visibly tracks reels, braces for reveals and performs multi-pose feature/win
 * reactions instead of behaving like one translated sticker.
 */
export const GoldenTigerTigerStage = memo(function GoldenTigerTigerStage({
  reaction,
  featureActive,
  lockedCount,
}: Props) {
  const [idleBlink, setIdleBlink] = useState(false);
  const [actingBeat, setActingBeat] = useState(0);

  useEffect(() => {
    if (reaction !== "idle" || reducedMotion()) {
      setIdleBlink(false);
      return;
    }

    let cancelled = false;
    let blinkTimer = 0;
    let releaseTimer = 0;

    const scheduleBlink = () => {
      const delay = 2_600 + Math.round(Math.random() * 1_800);
      blinkTimer = window.setTimeout(() => {
        if (cancelled) return;
        setIdleBlink(true);
        releaseTimer = window.setTimeout(() => {
          if (cancelled) return;
          setIdleBlink(false);
          scheduleBlink();
        }, 145);
      }, delay);
    };

    scheduleBlink();
    return () => {
      cancelled = true;
      window.clearTimeout(blinkTimer);
      window.clearTimeout(releaseTimer);
    };
  }, [reaction]);

  useEffect(() => {
    setActingBeat(0);
    if (reaction === "idle" || reducedMotion()) return;

    const cadence =
      reaction === "feature" ? 330 :
      reaction === "win" || reaction === "full" ? 430 :
      reaction === "reveal" || reaction === "tense" ? 390 : 560;

    const timer = window.setInterval(() => {
      setActingBeat((value) => (value + 1) % 12);
    }, cadence);

    return () => window.clearInterval(timer);
  }, [reaction, lockedCount]);

  const pose: TigerPose = reaction === "idle" && idleBlink
    ? "blink"
    : actingPose(reaction, actingBeat);
  const celebrationPose = reaction === "feature" || reaction === "win" || reaction === "full";

  return (
    <div
      className="gt-hw-tiger-stage"
      data-reaction={reaction}
      data-feature={featureActive ? "on" : "off"}
      data-celebration={celebrationPose ? "true" : "false"}
    >
      <span className="gt-hw-tiger-stage-halo" aria-hidden />
      <span className="gt-hw-tiger-stage-shadow" aria-hidden />
      <span className="gt-hw-tiger-stage-ray gt-hw-tiger-stage-ray--left" aria-hidden />
      <span className="gt-hw-tiger-stage-ray gt-hw-tiger-stage-ray--right" aria-hidden />

      <div
        className="gt-hw-tiger-rig"
        data-pose={pose}
        data-acting={actingBeat % 2 === 0 ? "primary" : "secondary"}
        aria-hidden
      >
        <span
          className="gt-hw-tiger-sprite"
          style={{ backgroundImage: `url(${tigerPoseAtlas})` }}
        />
        <span className="gt-hw-tiger-eye-flare gt-hw-tiger-eye-flare--left" />
        <span className="gt-hw-tiger-eye-flare gt-hw-tiger-eye-flare--right" />
        <span className="gt-hw-tiger-crown-flare" />
        <span className="gt-hw-tiger-medallion-flare" />
      </div>

      <div className="gt-hw-tiger-sparks" aria-hidden>
        {Array.from({ length: 16 }, (_, index) => <i key={index} />)}
      </div>

      <div className="gt-hw-tiger-caption">
        <strong>{featureActive ? `${lockedCount}/9` : "3×3"}</strong>
        <span>{featureActive ? "SÍMBOLOS FIXOS" : "5 LINHAS FIXAS"}</span>
      </div>
    </div>
  );
});
