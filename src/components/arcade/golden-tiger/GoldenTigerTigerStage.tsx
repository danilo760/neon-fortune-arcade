import { memo, useEffect, useState } from "react";

import tigerPoseAtlas from "@/assets/golden-tiger/tiger-pose-atlas.webp";
import { goldenTigerPose, type TigerReactionState } from "@/lib/arcade/goldenTigerActing";

export type { TigerReactionState } from "@/lib/arcade/goldenTigerActing";

type Props = {
  reaction: TigerReactionState;
  featureActive: boolean;
  lockedCount: number;
};

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Presentation-only mascot stage using an original 4×2 pose atlas.
 *
 * Pose order: idle, blink, watch, tense / reveal, feature, win, full.
 * Active poses follow the parent's reel/feature/win timeline. Only idle blinks
 * have a local timer: an independent acting loop must not invent game events.
 */
export const GoldenTigerTigerStage = memo(function GoldenTigerTigerStage({
  reaction,
  featureActive,
  lockedCount,
}: Props) {
  const [idleBlink, setIdleBlink] = useState(false);

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

  const pose = goldenTigerPose(reaction, idleBlink);
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
        data-acting="primary"
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
