import { memo, useEffect, useRef, useState } from "react";

import tigerPoseAtlas from "@/assets/golden-tiger/tiger-pose-atlas.webp";
import {
  goldenTigerPose,
  goldenTigerPoseTransitionMs,
  type TigerPose,
  type TigerReactionState,
} from "@/lib/arcade/goldenTigerActing";

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
 * Gameplay owns the major acting state. This component adds a short authored
 * overlap between adjacent atlas poses plus restrained idle breaks (blink/look)
 * so the mascot keeps breathing and occasionally redirects attention while the
 * player is waiting. Idle breaks never run during gameplay states.
 */
export const GoldenTigerTigerStage = memo(function GoldenTigerTigerStage({
  reaction,
  featureActive,
  lockedCount,
}: Props) {
  const [idleBreak, setIdleBreak] = useState<"none" | "blink" | "look">("none");
  const requestedPose = reaction === "idle" && idleBreak === "look"
    ? "watch"
    : goldenTigerPose(reaction, idleBreak === "blink");
  const activePoseRef = useRef<TigerPose>(requestedPose);
  const [activePose, setActivePose] = useState<TigerPose>(requestedPose);
  const [previousPose, setPreviousPose] = useState<TigerPose | null>(null);
  const [transitionMs, setTransitionMs] = useState(0);

  useEffect(() => {
    if (reaction !== "idle" || reducedMotion()) {
      setIdleBreak("none");
      return;
    }

    let cancelled = false;
    let breakTimer = 0;
    let releaseTimer = 0;

    const scheduleIdleBreak = () => {
      const delay = 4_000 + Math.round(Math.random() * 3_000);
      breakTimer = window.setTimeout(() => {
        if (cancelled) return;
        const nextBreak = Math.random() < 0.62 ? "blink" : "look";
        setIdleBreak(nextBreak);
        releaseTimer = window.setTimeout(() => {
          if (cancelled) return;
          setIdleBreak("none");
          scheduleIdleBreak();
        }, nextBreak === "blink" ? 155 : 720);
      }, delay);
    };

    scheduleIdleBreak();
    return () => {
      cancelled = true;
      window.clearTimeout(breakTimer);
      window.clearTimeout(releaseTimer);
    };
  }, [reaction]);

  useEffect(() => {
    const from = activePoseRef.current;
    if (from === requestedPose) return;

    const duration = goldenTigerPoseTransitionMs(from, requestedPose, reducedMotion());
    activePoseRef.current = requestedPose;
    setActivePose(requestedPose);

    if (duration <= 0) {
      setPreviousPose(null);
      setTransitionMs(0);
      return;
    }

    setPreviousPose(from);
    setTransitionMs(duration);
    const timer = window.setTimeout(() => {
      setPreviousPose(null);
      setTransitionMs(0);
    }, duration + 24);
    return () => window.clearTimeout(timer);
  }, [requestedPose]);

  const celebrationPose = reaction === "feature" || reaction === "win" || reaction === "full";

  return (
    <div
      className="gt-hw-tiger-stage"
      data-reaction={reaction}
      data-feature={featureActive ? "on" : "off"}
      data-celebration={celebrationPose ? "true" : "false"}
      data-pose-transition={previousPose ? "active" : "settled"}
      data-idle-break={reaction === "idle" ? idleBreak : "none"}
    >
      <span className="gt-hw-tiger-stage-halo" aria-hidden />
      <span className="gt-hw-tiger-stage-shadow" aria-hidden />
      <span className="gt-hw-tiger-stage-ray gt-hw-tiger-stage-ray--left" aria-hidden />
      <span className="gt-hw-tiger-stage-ray gt-hw-tiger-stage-ray--right" aria-hidden />

      <div
        className="gt-hw-tiger-rig"
        data-pose={activePose}
        data-acting="primary"
        aria-hidden
      >
        {/* Keep the active actor first in DOM so visual QA and assistive tooling
            always measure the live pose, even during the short overlap window. */}
        <span
          className={`gt-hw-tiger-pose-layer gt-hw-tiger-pose-layer--current${previousPose ? " is-entering" : ""}`}
          data-pose={activePose}
          style={previousPose ? { animationDuration: `${transitionMs}ms` } : undefined}
        >
          <span
            className="gt-hw-tiger-sprite"
            style={{ backgroundImage: `url(${tigerPoseAtlas})` }}
          />
        </span>
        {previousPose && (
          <span
            className="gt-hw-tiger-pose-layer gt-hw-tiger-pose-layer--exit"
            data-pose={previousPose}
            style={{ animationDuration: `${transitionMs}ms` }}
          >
            <span
              className="gt-hw-tiger-sprite"
              style={{ backgroundImage: `url(${tigerPoseAtlas})` }}
            />
          </span>
        )}
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
