import { memo } from "react";

import tigerMascot from "@/assets/golden-tiger/golden-tiger-mascot.webp";

export type TigerReactionState = "idle" | "watch" | "reveal" | "coin" | "tense" | "win" | "full";

type Props = {
  reaction: TigerReactionState;
  featureActive: boolean;
  lockedCount: number;
};

/**
 * Presentation-only tiger rig.
 *
 * A single original transparent mascot is rendered as overlapping clipped
 * layers. That keeps the artwork coherent while allowing the head and body to
 * move independently for anticipation/follow-through without shipping a
 * commercial sprite or a large skeletal-animation dependency.
 */
export const GoldenTigerTigerStage = memo(function GoldenTigerTigerStage({
  reaction,
  featureActive,
  lockedCount,
}: Props) {
  return (
    <div
      className="gt-hw-tiger-stage"
      data-reaction={reaction}
      data-feature-active={featureActive ? "true" : "false"}
      aria-hidden
    >
      <div className="gt-hw-tiger-spotlight" />
      <div className="gt-hw-tiger-aura" />
      <div className="gt-hw-tiger-floor-shadow" />

      <div className="gt-hw-tiger-rig">
        <img
          src={tigerMascot}
          alt=""
          className="gt-hw-tiger-layer gt-hw-tiger-layer--body"
          draggable={false}
        />
        <img
          src={tigerMascot}
          alt=""
          className="gt-hw-tiger-layer gt-hw-tiger-layer--head"
          draggable={false}
        />
        <span className="gt-hw-tiger-eye-flash gt-hw-tiger-eye-flash--left" />
        <span className="gt-hw-tiger-eye-flash gt-hw-tiger-eye-flash--right" />
        <span className="gt-hw-tiger-crown-flare" />
        <span className="gt-hw-tiger-coin-prop" />
      </div>

      <div className="gt-hw-tiger-sparks">
        {Array.from({ length: 14 }, (_, index) => <i key={index} />)}
      </div>

      <div className="gt-hw-tiger-caption">
        <strong>{featureActive ? `${lockedCount}/9` : "3×3"}</strong>
        <span>{featureActive ? "MOEDAS TRAVADAS" : "5 LINHAS FIXAS"}</span>
      </div>
    </div>
  );
});
