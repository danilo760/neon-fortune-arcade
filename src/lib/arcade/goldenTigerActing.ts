export type TigerReactionState = "idle" | "watch" | "reveal" | "feature" | "tense" | "win" | "full";
export type TigerPose = TigerReactionState | "blink";

/** Keep authored acting on the same timeline as reels, particles and audio. */
export function goldenTigerPose(reaction: TigerReactionState, idleBlink: boolean): TigerPose {
  return reaction === "idle" && idleBlink ? "blink" : reaction;
}

/**
 * Pose artwork is discrete, but the actor should not visibly pop between atlas
 * cells. Active reactions overlap longer; the natural eye blink remains quick.
 */
export function goldenTigerPoseTransitionMs(from: TigerPose, to: TigerPose, reduceMotion = false) {
  if (reduceMotion || from === to) return 0;
  if (from === "blink" || to === "blink") return 105;
  if (to === "full") return 520;
  if (to === "win" || to === "feature") return 460;
  if (to === "tense" || to === "reveal") return 390;
  return 330;
}

/*
 * Presentation sidecar for the existing Golden Tiger only. Keeping it here
 * avoids creating a second stylesheet/version while the consolidated premium
 * sheet remains the only static CSS import. It is SSR-safe and installed once.
 */
const GOLDEN_TIGER_ACTING_STYLE_ID = "golden-tiger-integrated-acting";
const GOLDEN_TIGER_ACTING_CSS = String.raw`
.gt-hw-page .gt-premium-machine .gt-hw-tiger-rig{
  animation:gt-integrated-tiger-breathe 4.8s cubic-bezier(.44,0,.56,1) infinite!important;
  transform-origin:50% 92%!important;
  will-change:transform;
}
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage[data-reaction="watch"] .gt-hw-tiger-rig{
  animation:gt-integrated-tiger-watch 2.35s ease-in-out infinite alternate!important;
}
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage[data-reaction="tense"] .gt-hw-tiger-rig{
  animation:gt-integrated-tiger-tense 1.22s ease-in-out infinite alternate!important;
}
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage[data-reaction="feature"] .gt-hw-tiger-rig{
  animation:gt-integrated-tiger-feature 1.7s cubic-bezier(.35,0,.35,1) infinite alternate!important;
}
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage[data-reaction="win"] .gt-hw-tiger-rig{
  animation:gt-integrated-tiger-win 1.55s cubic-bezier(.18,.72,.2,1) infinite alternate!important;
}
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage[data-reaction="full"] .gt-hw-tiger-rig{
  animation:gt-integrated-tiger-full 1.35s cubic-bezier(.18,.72,.2,1) infinite alternate!important;
}
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage[data-pose-transition="active"] .gt-hw-tiger-pose-layer--current{
  animation:gt-integrated-pose-in .44s cubic-bezier(.18,.78,.2,1) both!important;
}
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage[data-pose-transition="active"] .gt-hw-tiger-pose-layer--exit{
  animation:gt-integrated-pose-out .44s cubic-bezier(.35,0,.4,1) both!important;
}
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage[data-reaction="feature"] .gt-hw-tiger-stage-halo,
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage[data-reaction="win"] .gt-hw-tiger-stage-halo,
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage[data-reaction="full"] .gt-hw-tiger-stage-halo{
  animation:gt-integrated-halo 1.8s ease-in-out infinite alternate!important;
}

/* Physical bridge: mascot marquee, reels, readout and controls read as one cabinet. */
.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage::after{
  content:"";position:absolute;z-index:1;left:7%;right:7%;bottom:-9px;height:22px;pointer-events:none;
  border:1px solid rgba(255,216,106,.82);border-radius:50% 50% 12px 12px/60% 60% 12px 12px;
  background:linear-gradient(180deg,#d99b32 0%,#8f3a12 18%,#5f0d0d 54%,#310509 100%);
  box-shadow:inset 0 2px 0 rgba(255,244,190,.55),inset 0 -5px 8px rgba(38,0,2,.55),0 5px 11px rgba(0,0,0,.35),0 0 14px rgba(255,190,56,.12);
}
.gt-hw-page .gt-premium-machine .gt-premium-grid{
  border-color:rgba(244,198,82,.92)!important;
  box-shadow:0 -5px 0 rgba(91,18,8,.82),0 8px 0 rgba(92,17,7,.9),0 11px 22px rgba(0,0,0,.42),inset 0 0 0 1px rgba(255,232,145,.2)!important;
}
.gt-hw-page .gt-premium-machine .gt-hw-status{
  margin-top:0!important;border-radius:0!important;border-left-color:rgba(222,165,55,.72)!important;border-right-color:rgba(222,165,55,.72)!important;
  background:linear-gradient(180deg,rgba(115,20,16,.98),rgba(67,7,11,.99))!important;
  box-shadow:inset 0 1px 0 rgba(255,226,137,.16),inset 0 -1px 0 rgba(32,0,3,.65)!important;
}
.gt-hw-page .gt-premium-machine .gt-hw-hud{
  margin-top:0!important;border-radius:0!important;border-top:1px solid rgba(246,198,82,.62)!important;
  border-bottom:1px solid rgba(246,198,82,.55)!important;background:linear-gradient(180deg,#6a1113,#35060a)!important;
  box-shadow:inset 0 1px 0 rgba(255,234,163,.15),inset 0 -6px 10px rgba(20,0,2,.34)!important;
}
.gt-hw-page .gt-premium-machine .gt-hw-controls.gt-commercial-console{
  margin-top:0!important;border-top:0!important;border-radius:0 0 24px 24px!important;
}
.gt-hw-page .gt-premium-machine[data-phase="win"] .gt-hw-tiger-stage::after,
.gt-hw-page .gt-premium-machine[data-phase="full-grid"] .gt-hw-tiger-stage::after,
.gt-hw-page .gt-premium-machine[data-feature-mode="active"] .gt-hw-tiger-stage::after{
  filter:brightness(1.14) saturate(1.08);box-shadow:inset 0 2px 0 rgba(255,250,207,.72),0 0 22px rgba(255,190,57,.3),0 6px 12px rgba(0,0,0,.36);
}

@keyframes gt-integrated-tiger-breathe{0%,100%{transform:translate3d(0,1px,0) scale(1)}50%{transform:translate3d(0,-2px,0) scale(1.012)}}
@keyframes gt-integrated-tiger-watch{0%{transform:translate3d(-1px,0,0) rotate(-.35deg)}100%{transform:translate3d(2px,-2px,0) rotate(.45deg)}}
@keyframes gt-integrated-tiger-tense{0%{transform:translate3d(-1px,1px,0) scale(.997)}100%{transform:translate3d(1px,-2px,0) scale(1.018)}}
@keyframes gt-integrated-tiger-feature{0%{transform:translate3d(0,1px,0) scale(1.01)}100%{transform:translate3d(0,-4px,0) scale(1.035)}}
@keyframes gt-integrated-tiger-win{0%{transform:translate3d(0,1px,0) scale(1.012) rotate(-.2deg)}100%{transform:translate3d(0,-5px,0) scale(1.04) rotate(.35deg)}}
@keyframes gt-integrated-tiger-full{0%{transform:translate3d(0,1px,0) scale(1.02)}100%{transform:translate3d(0,-6px,0) scale(1.055)}}
@keyframes gt-integrated-pose-in{0%{opacity:.12;transform:translate3d(0,5px,0) scale(.975);filter:brightness(.92)}58%{opacity:.9;transform:translate3d(0,-1px,0) scale(1.008);filter:brightness(1.07)}100%{opacity:1;transform:none;filter:brightness(1)}}
@keyframes gt-integrated-pose-out{0%{opacity:1;transform:none;filter:brightness(1)}100%{opacity:0;transform:translate3d(0,-3px,0) scale(1.018);filter:brightness(1.08)}}
@keyframes gt-integrated-halo{from{opacity:.56;transform:translate(-50%,-50%) scale(.96)}to{opacity:.92;transform:translate(-50%,-50%) scale(1.06)}}
@media(prefers-reduced-motion:reduce){
  .gt-hw-page .gt-premium-machine .gt-hw-tiger-rig,.gt-hw-page .gt-premium-machine .gt-hw-tiger-stage-halo,
  .gt-hw-page .gt-premium-machine .gt-hw-tiger-pose-layer--current,.gt-hw-page .gt-premium-machine .gt-hw-tiger-pose-layer--exit{animation:none!important}
}
`;

function installGoldenTigerIntegratedActing() {
  if (typeof document === "undefined" || document.getElementById(GOLDEN_TIGER_ACTING_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = GOLDEN_TIGER_ACTING_STYLE_ID;
  style.textContent = GOLDEN_TIGER_ACTING_CSS;
  document.head.appendChild(style);
}

installGoldenTigerIntegratedActing();
