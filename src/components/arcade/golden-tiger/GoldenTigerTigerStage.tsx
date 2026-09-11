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

const GOLDEN_TIGER_FUTURE_POLISH = String.raw`
/* Symbol atlas is 4×2. Correcting this removes the cut/zoomed artwork. */
.gt-hw-page .gt-premium-machine .gt-hw-symbol{width:100%!important;height:100%!important;overflow:visible!important;padding:5%!important;box-sizing:border-box!important}
.gt-hw-page .gt-premium-machine .gt-hw-symbol-raster{inset:5%!important;overflow:hidden!important;border-radius:13%!important;transform:translateZ(0)!important}
.gt-hw-page .gt-premium-machine .gt-hw-symbol-raster>img{left:var(--gt-premium-symbol-x)!important;top:var(--gt-premium-symbol-y)!important;width:400%!important;height:200%!important;max-width:none!important;object-fit:fill!important}
.gt-hw-page .gt-premium-machine .gt-hw-reel-item .gt-hw-symbol{padding:6%!important}
.gt-hw-page .gt-premium-machine .gt-hw-reel-item .gt-hw-symbol-raster{inset:6%!important}

/* Stable mascot anchor and slower acting. */
.gt-hw-page .gt-premium-machine .gt-hw-tiger-rig{width:clamp(194px,52vw,220px)!important;height:132px!important;transform:translate3d(0,0,0)!important;transform-origin:50% 92%!important;animation:none!important}
.gt-hw-page .gt-premium-machine .gt-hw-tiger-sprite{left:50%!important;bottom:-23px!important;width:clamp(194px,52vw,220px)!important;aspect-ratio:1!important;background-size:400% 200%!important;transform-origin:50% 88%!important}
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage[data-reaction="idle"] .gt-hw-tiger-pose-layer--current>.gt-hw-tiger-sprite{animation:gt-s3-tiger-breathe 5.6s cubic-bezier(.45,0,.55,1) infinite!important}
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage[data-reaction="watch"] .gt-hw-tiger-pose-layer--current>.gt-hw-tiger-sprite{animation:gt-s3-tiger-watch 2.55s ease-in-out infinite alternate!important}
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage[data-reaction="tense"] .gt-hw-tiger-pose-layer--current>.gt-hw-tiger-sprite{animation:gt-s3-tiger-tense 1.08s ease-in-out infinite alternate!important}
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage[data-reaction="reveal"] .gt-hw-tiger-pose-layer--current>.gt-hw-tiger-sprite{animation:gt-s3-tiger-reveal .82s cubic-bezier(.16,.82,.2,1.08) both!important}
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage[data-reaction="feature"] .gt-hw-tiger-pose-layer--current>.gt-hw-tiger-sprite{animation:gt-s3-tiger-feature 1.28s cubic-bezier(.2,.72,.2,1) both!important}
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage[data-reaction="win"] .gt-hw-tiger-pose-layer--current>.gt-hw-tiger-sprite{animation:gt-s3-tiger-win 1.36s cubic-bezier(.16,.82,.18,1.08) both!important}
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage[data-reaction="full"] .gt-hw-tiger-pose-layer--current>.gt-hw-tiger-sprite{animation:gt-s3-tiger-full 1.8s cubic-bezier(.2,.74,.22,1) infinite alternate!important}

/* Futuristic physical control deck: obsidian chassis, gold mechanics, teal light. */
.gt-hw-page .gt-premium-machine .gt-hw-hud{background:linear-gradient(180deg,rgba(28,20,28,.98),rgba(8,8,13,.99))!important;border-color:rgba(110,245,224,.22)!important;box-shadow:inset 0 1px 0 rgba(214,255,247,.10),inset 0 -6px 12px rgba(0,0,0,.35),0 4px 10px rgba(0,0,0,.30)!important}
.gt-hw-page .gt-premium-machine .gt-hw-controls.gt-commercial-console{isolation:isolate!important;overflow:visible!important;border-top:1px solid rgba(111,245,228,.34)!important;background:linear-gradient(112deg,transparent 0 7%,rgba(65,230,213,.05) 7.2% 8.2%,transparent 8.4% 91%,rgba(255,194,66,.05) 91.2% 92.2%,transparent 92.4%),radial-gradient(ellipse at 50% -28%,rgba(64,247,222,.14),transparent 48%),linear-gradient(180deg,#251019 0%,#120810 46%,#07060b 100%)!important;box-shadow:inset 0 1px 0 rgba(164,255,241,.13),inset 0 -14px 25px rgba(0,0,0,.52),0 -1px 0 rgba(235,188,78,.24),0 10px 22px rgba(0,0,0,.42),0 0 24px rgba(39,203,189,.07)!important}
.gt-hw-page .gt-premium-machine .gt-hw-controls.gt-commercial-console:before{content:"";position:absolute;z-index:-1;inset:5px 8px 7px;border-radius:18px;border:1px solid rgba(88,240,221,.12);background:linear-gradient(90deg,rgba(255,207,91,.025),rgba(52,245,219,.045) 50%,rgba(255,207,91,.025));box-shadow:inset 0 0 18px rgba(44,218,202,.04);pointer-events:none}
.gt-hw-page .gt-premium-machine .gt-hw-main-controls>button:not(.gt-hw-spin),.gt-hw-page .gt-premium-machine .gt-premium-secondary>button:not(:nth-child(2)){position:relative!important;border:1px solid rgba(245,198,91,.66)!important;background:radial-gradient(circle at 36% 28%,rgba(115,255,236,.18),transparent 26%),radial-gradient(circle at 50% 55%,#232230 0%,#11131d 58%,#08090f 100%)!important;color:#8ff8e8!important;text-shadow:0 0 8px rgba(88,248,225,.34)!important;box-shadow:inset 0 1px 0 rgba(214,255,247,.18),inset 0 -7px 10px rgba(0,0,0,.50),0 0 0 2px rgba(76,32,13,.72),0 4px 0 #321306,0 8px 14px rgba(0,0,0,.42),0 0 12px rgba(65,237,216,.12)!important}
.gt-hw-page .gt-premium-machine .gt-hw-main-controls>button:not(.gt-hw-spin):after,.gt-hw-page .gt-premium-machine .gt-premium-secondary>button:not(:nth-child(2)):after{content:"";position:absolute;inset:5px;border-radius:50%;border:1px solid rgba(96,250,229,.15);box-shadow:inset 0 0 9px rgba(55,236,214,.06);pointer-events:none}
.gt-hw-page .gt-premium-machine .gt-hw-main-controls>button:not(.gt-hw-spin){color:#ffd973!important;font-weight:850!important;text-shadow:0 0 8px rgba(255,198,70,.28)!important}
.gt-hw-page .gt-premium-machine .gt-hw-spin{border:4px solid #f1c756!important;background:radial-gradient(circle at 33% 24%,rgba(239,255,251,.90) 0 3%,rgba(120,255,227,.22) 4% 10%,transparent 11%),radial-gradient(circle at 50% 45%,#5dffe0 0 17%,#22d6b5 35%,#0a967f 58%,#045b55 76%,#022e34 100%)!important;box-shadow:inset 0 3px 0 rgba(230,255,248,.58),inset 0 -11px 16px rgba(0,46,50,.62),inset 0 0 22px rgba(118,255,232,.24),0 0 0 3px #5b210b,0 0 0 6px rgba(236,188,64,.48),0 5px 0 #3c1408,0 11px 18px rgba(0,0,0,.52),0 0 24px rgba(54,242,212,.34)!important;filter:saturate(1.08) contrast(1.04)!important}
.gt-hw-page .gt-premium-machine .gt-hw-spin:before{content:"";position:absolute;inset:-9px;border-radius:50%;border:1px solid rgba(89,247,224,.30);box-shadow:0 0 13px rgba(66,238,215,.18),inset 0 0 8px rgba(255,205,77,.10);pointer-events:none}
.gt-hw-page .gt-premium-machine .gt-hw-spin:after{inset:12px!important;border:1px solid rgba(218,255,247,.42)!important;box-shadow:inset 0 0 14px rgba(133,255,235,.18),0 0 9px rgba(70,239,216,.11)!important}
.gt-hw-page .gt-premium-machine[data-phase="base-spin"] .gt-hw-spin,.gt-hw-page .gt-premium-machine[data-phase^="feature-"] .gt-hw-spin{animation:gt-future-spin-energy 1.65s ease-in-out infinite alternate!important}
.gt-hw-page .gt-premium-machine .gt-premium-secondary>button:nth-child(1).is-active{color:#baffef!important;border-color:rgba(111,255,233,.88)!important;background:radial-gradient(circle at 50% 42%,#164e4c 0%,#122b31 54%,#091117 100%)!important;box-shadow:inset 0 0 15px rgba(95,255,231,.18),0 0 0 2px rgba(77,37,12,.76),0 4px 0 #321306,0 0 17px rgba(70,244,218,.32)!important}
.gt-hw-page .gt-premium-machine .gt-premium-secondary>button:nth-child(2){border:1px solid rgba(241,199,94,.62)!important;background:linear-gradient(180deg,rgba(35,45,54,.97),rgba(13,16,24,.99))!important;color:#f8d66f!important;box-shadow:inset 0 1px 0 rgba(196,255,244,.10),inset 0 -4px 7px rgba(0,0,0,.38),0 2px 6px rgba(0,0,0,.45),0 0 10px rgba(255,196,64,.08)!important}
.gt-hw-page .gt-premium-machine .gt-hw-win-ribbon{min-width:min(82%,310px)!important;padding:9px 18px 10px!important;border-color:rgba(106,255,231,.34)!important;background:radial-gradient(ellipse at 50% 0%,rgba(91,255,226,.12),transparent 48%),linear-gradient(180deg,rgba(41,15,20,.97),rgba(12,8,15,.98))!important;box-shadow:0 9px 22px rgba(0,0,0,.50),0 0 18px rgba(74,239,213,.11),inset 0 1px 0 rgba(255,221,132,.15)!important}
@keyframes gt-future-spin-energy{from{filter:saturate(1.04) brightness(.94)}to{filter:saturate(1.12) brightness(1.08)}}
@media(max-width:390px){.gt-hw-page .gt-premium-machine .gt-hw-symbol{padding:6%!important}.gt-hw-page .gt-premium-machine .gt-hw-symbol-raster{inset:6%!important}}
@media(prefers-reduced-motion:reduce){.gt-hw-page .gt-premium-machine[data-phase="base-spin"] .gt-hw-spin,.gt-hw-page .gt-premium-machine[data-phase^="feature-"] .gt-hw-spin{animation:none!important}}
`;

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Presentation-only mascot stage using an original 4×2 pose atlas.
 *
 * Pose order: idle, blink, watch, tense / reveal, feature, win, full.
 * Gameplay owns the acting state. This component only adds a short authored
 * overlap between adjacent atlas poses so the mascot reads as one performer
 * rather than an instantaneous sprite replacement. Idle blinking remains the
 * only locally scheduled action.
 */
export const GoldenTigerTigerStage = memo(function GoldenTigerTigerStage({
  reaction,
  featureActive,
  lockedCount,
}: Props) {
  const [idleBlink, setIdleBlink] = useState(false);
  const requestedPose = goldenTigerPose(reaction, idleBlink);
  const activePoseRef = useRef<TigerPose>(requestedPose);
  const [activePose, setActivePose] = useState<TigerPose>(requestedPose);
  const [previousPose, setPreviousPose] = useState<TigerPose | null>(null);
  const [transitionMs, setTransitionMs] = useState(0);

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
    >
      <style data-golden-tiger-future-polish>{GOLDEN_TIGER_FUTURE_POLISH}</style>
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
