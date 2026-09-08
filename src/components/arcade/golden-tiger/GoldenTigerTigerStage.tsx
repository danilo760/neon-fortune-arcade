import { memo } from "react";

import tigerMascot from "@/assets/golden-tiger/golden-tiger-mascot.webp";

export type TigerReactionState = "idle" | "watch" | "reveal" | "coin" | "tense" | "win" | "full";

type Props = {
  reaction: TigerReactionState;
  featureActive: boolean;
  lockedCount: number;
};

/**
 * Golden Tiger mascot stage.
 *
 * Uses one original transparent mascot image, but splits it into layered
 * presentation pieces so the head, eyes, coin prop, aura and body can move
 * independently. This gives us a much stronger “alive” feel without bringing in
 * a heavy animation runtime.
 */
export const GoldenTigerTigerStage = memo(function GoldenTigerTigerStage({
  reaction,
  featureActive,
  lockedCount,
}: Props) {
  return (
    <div className="gt-hw-tiger-stage" data-reaction={reaction} data-feature={featureActive ? "on" : "off"}>
      <span className="gt-hw-tiger-stage-halo" aria-hidden />
      <span className="gt-hw-tiger-stage-shadow" aria-hidden />
      <span className="gt-hw-tiger-stage-ray gt-hw-tiger-stage-ray--left" aria-hidden />
      <span className="gt-hw-tiger-stage-ray gt-hw-tiger-stage-ray--right" aria-hidden />

      <div className="gt-hw-tiger-rig" aria-hidden>
        <div className="gt-hw-tiger-body-shell">
          <img className="gt-hw-tiger-body" src={tigerMascot} alt="" />
        </div>

        <div className="gt-hw-tiger-head-shell">
          <img className="gt-hw-tiger-head" src={tigerMascot} alt="" />
          <span className="gt-hw-tiger-eye-glow gt-hw-tiger-eye-glow--left" />
          <span className="gt-hw-tiger-eye-glow gt-hw-tiger-eye-glow--right" />
          <span className="gt-hw-tiger-shine gt-hw-tiger-shine--left" />
          <span className="gt-hw-tiger-shine gt-hw-tiger-shine--right" />
        </div>

        <span className="gt-hw-tiger-coin-prop" />
        <span className="gt-hw-tiger-crown-flare" />
        <span className="gt-hw-tiger-medallion-flare" />
      </div>

      <div className="gt-hw-tiger-sparks" aria-hidden>
        {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
      </div>

      <div className="gt-hw-tiger-caption">
        <strong>{featureActive ? `${lockedCount}/9` : "3×3"}</strong>
        <span>{featureActive ? "MOEDAS TRAVADAS" : "5 LINHAS FIXAS"}</span>
      </div>
    </div>
  );
});
