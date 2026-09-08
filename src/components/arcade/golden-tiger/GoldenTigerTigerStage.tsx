import { memo } from "react";

import tigerIdle from "@/assets/golden-tiger/tiger-idle.webp";
import tigerWin from "@/assets/golden-tiger/tiger-win.webp";

export type TigerReactionState = "idle" | "watch" | "reveal" | "coin" | "tense" | "win" | "full";

type Props = {
  reaction: TigerReactionState;
  featureActive: boolean;
  lockedCount: number;
};

/**
 * Presentation-only mascot stage.
 *
 * Two original pose renders are still blended by state. The next art pass will
 * replace this compromise with dedicated acting poses; CSS remains limited to
 * micro-motion while gameplay math stays separate from presentation.
 */
export const GoldenTigerTigerStage = memo(function GoldenTigerTigerStage({
  reaction,
  featureActive,
  lockedCount,
}: Props) {
  const celebrationPose = reaction === "coin" || reaction === "win" || reaction === "full";

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

      <div className="gt-hw-tiger-rig" aria-hidden>
        <img
          src={tigerIdle}
          alt=""
          className="gt-hw-tiger-pose gt-hw-tiger-pose--idle"
          draggable={false}
          decoding="async"
        />
        <img
          src={tigerWin}
          alt=""
          className="gt-hw-tiger-pose gt-hw-tiger-pose--win"
          draggable={false}
          decoding="async"
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
