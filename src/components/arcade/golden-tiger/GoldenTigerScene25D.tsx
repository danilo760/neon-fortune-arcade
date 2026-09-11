import type { CSSProperties } from "react";
import { architecture, backplate, foreground, mascotPlatform, reelsFrame } from "./GoldenTigerSceneAssets";

export type GoldenTigerLightingMode = "idle" | "spin" | "feature" | "win" | "full";

const SCENE_PARTICLES = Array.from({ length: 12 }, (_, index) => ({
  left: 8 + ((index * 31) % 84),
  top: 18 + ((index * 23) % 66),
  delay: -((index * 0.37) % 3.4),
  duration: 2.8 + (index % 5) * 0.42,
  size: 2 + (index % 3),
}));

/**
 * Final presentation polish stays inside the existing Golden Tiger scene.
 * It does not alter outcomes, RNG, RTP, payout or settlement.
 */
const FINAL_POLISH = String.raw`
/* ========================================================================== */
/* REEL WEIGHT — slow visible fall, then impact + settle                       */
/* ========================================================================== */
.gt-hw-page .gt-premium-machine .gt-premium-grid[data-landing-column="0"] .gt-hw-cell:nth-child(3n+1) {
  animation: gt-final-heavy-land .58s cubic-bezier(.12,.72,.15,1.14) 1.02s both !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-grid[data-landing-column="1"] .gt-hw-cell:nth-child(3n+2) {
  animation: gt-final-heavy-land .60s cubic-bezier(.12,.72,.15,1.14) 1.14s both !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-grid[data-landing-column="2"] .gt-hw-cell:nth-child(3n+3) {
  animation: gt-final-heavy-land .62s cubic-bezier(.12,.72,.15,1.14) 1.27s both !important;
}

.gt-hw-page .gt-premium-machine:has(.gt-premium-secondary > button:first-child.is-active) .gt-premium-grid[data-landing-column="0"] .gt-hw-cell:nth-child(3n+1) {
  animation-delay: .24s !important;
  animation-duration: .26s !important;
}
.gt-hw-page .gt-premium-machine:has(.gt-premium-secondary > button:first-child.is-active) .gt-premium-grid[data-landing-column="1"] .gt-hw-cell:nth-child(3n+2) {
  animation-delay: .28s !important;
  animation-duration: .27s !important;
}
.gt-hw-page .gt-premium-machine:has(.gt-premium-secondary > button:first-child.is-active) .gt-premium-grid[data-landing-column="2"] .gt-hw-cell:nth-child(3n+3) {
  animation-delay: .32s !important;
  animation-duration: .28s !important;
}

@keyframes gt-final-heavy-land {
  0% {
    opacity: .82;
    transform: translate3d(0,-28px,0) scaleY(1.06) scaleX(.985);
    filter: brightness(.92) saturate(.92);
  }
  48% {
    opacity: 1;
    transform: translate3d(0,7px,0) scaleY(.94) scaleX(1.018);
    filter: brightness(1.18) saturate(1.08);
  }
  68% {
    transform: translate3d(0,-4px,0) scaleY(1.026) scaleX(.995);
    filter: brightness(1.08);
  }
  84% {
    transform: translate3d(0,2px,0) scaleY(.988);
  }
  100% {
    opacity: 1;
    transform: translate3d(0,0,0) scale(1);
    filter: brightness(1);
  }
}

/* Make reel movement readable instead of a bright blur. */
.gt-hw-page .gt-premium-machine .gt-hw-reel-track {
  filter: none !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-reel-overlay::before {
  opacity: .16 !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-reel-overlay.is-braking::before {
  opacity: .06 !important;
}

/* ========================================================================== */
/* WIN AMOUNT — every positive hit owns the center long enough to be read      */
/* ========================================================================== */
.gt-hw-page .gt-premium-machine .gt-hw-win-ribbon {
  top: 57% !important;
  width: min(88%, 366px) !important;
  min-height: 106px !important;
  padding: 15px 20px 17px !important;
  border: 2px solid #ffe08a !important;
  border-radius: 23px !important;
  background:
    radial-gradient(ellipse at 50% -10%, rgba(255,236,163,.34), transparent 52%),
    linear-gradient(180deg, rgba(132,24,12,.99), rgba(50,4,4,.99)) !important;
  box-shadow:
    0 18px 38px rgba(0,0,0,.72),
    0 0 0 2px rgba(105,24,6,.92),
    0 0 34px rgba(255,187,43,.34),
    inset 0 1px 0 rgba(255,250,218,.34),
    inset 0 -10px 18px rgba(46,3,2,.28) !important;
  animation: gt-final-win-in .42s cubic-bezier(.15,.82,.18,1.14) both !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-win-ribbon > span:first-child {
  font-size: 13px !important;
  font-weight: 950 !important;
  letter-spacing: .20em !important;
  color: #ffd86c !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-win-ribbon > span + span {
  margin-top: 7px !important;
  font-size: clamp(34px,10.5vw,48px) !important;
  line-height: .96 !important;
  color: #fff5c3 !important;
  text-shadow: 0 3px 0 #741007, 0 0 18px rgba(255,222,111,.62) !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-win-ribbon.is-return {
  min-height: 92px !important;
  background:
    radial-gradient(ellipse at 50% -15%, rgba(255,221,116,.24), transparent 52%),
    linear-gradient(180deg, rgba(102,16,9,.985), rgba(39,3,4,.99)) !important;
}

@keyframes gt-final-win-in {
  0% { opacity: 0; transform: translate(-50%,-43%) scale(.80); }
  58% { opacity: 1; transform: translate(-50%,-51%) scale(1.04); }
  100% { opacity: 1; transform: translate(-50%,-50%) scale(1); }
}

/* ========================================================================== */
/* CONTROL DECK — physical premium slot console, not generic web buttons       */
/* ========================================================================== */
.gt-hw-page .gt-premium-machine .gt-hw-controls.gt-commercial-console {
  position: relative !important;
  display: grid !important;
  grid-template-columns: 56px 52px 94px 52px 56px !important;
  grid-template-rows: 78px !important;
  justify-content: center !important;
  align-items: center !important;
  gap: 8px !important;
  width: 100% !important;
  padding: 7px 8px 10px !important;
  border: 1px solid rgba(213,159,58,.68) !important;
  border-radius: 18px 18px 24px 24px !important;
  background:
    radial-gradient(ellipse at 50% -22%, rgba(255,210,91,.12), transparent 48%),
    linear-gradient(180deg, #3d0909 0%, #1e0507 38%, #09090d 100%) !important;
  box-shadow:
    inset 0 2px 0 rgba(255,230,150,.12),
    inset 0 -14px 22px rgba(0,0,0,.46),
    0 10px 18px rgba(0,0,0,.42),
    0 0 0 2px rgba(63,8,5,.72) !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-main-controls,
.gt-hw-page .gt-premium-machine .gt-premium-secondary {
  display: contents !important;
}

/* − / + */
.gt-hw-page .gt-premium-machine .gt-hw-main-controls > button:not(.gt-hw-spin) {
  position: relative !important;
  width: 52px !important;
  height: 52px !important;
  min-width: 52px !important;
  min-height: 52px !important;
  padding: 0 !important;
  border: 2px solid #d7a43f !important;
  border-radius: 50% !important;
  background:
    radial-gradient(circle at 36% 27%, rgba(255,173,116,.16), transparent 28%),
    radial-gradient(circle at 50% 48%, #66140f 0%, #3c0808 56%, #160306 100%) !important;
  color: #ffe18a !important;
  font-size: 29px !important;
  font-weight: 800 !important;
  line-height: 1 !important;
  text-shadow: 0 2px 0 #4a0704, 0 0 7px rgba(255,201,70,.26) !important;
  box-shadow:
    inset 0 2px 0 rgba(255,235,171,.18),
    inset 0 -8px 10px rgba(0,0,0,.38),
    0 0 0 3px #54150a,
    0 0 0 5px rgba(227,174,65,.32),
    0 5px 0 #210406,
    0 9px 14px rgba(0,0,0,.44) !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-main-controls > button:first-child { grid-column: 2 !important; grid-row: 1 !important; }
.gt-hw-page .gt-premium-machine .gt-hw-main-controls > button:last-child { grid-column: 4 !important; grid-row: 1 !important; }
.gt-hw-page .gt-premium-machine .gt-hw-main-controls > button:not(.gt-hw-spin)::before {
  content: "" !important;
  position: absolute !important;
  inset: 5px !important;
  border: 1px solid rgba(255,223,137,.20) !important;
  border-radius: 50% !important;
  pointer-events: none !important;
}

/* Main Spin */
.gt-hw-page .gt-premium-machine .gt-hw-spin {
  grid-column: 3 !important;
  grid-row: 1 !important;
  width: 94px !important;
  height: 94px !important;
  max-width: none !important;
  justify-self: center !important;
  border: 4px solid #f0cb55 !important;
  border-radius: 50% !important;
  background:
    radial-gradient(circle at 34% 24%, rgba(244,255,244,.95) 0 3%, rgba(153,255,218,.27) 5% 10%, transparent 12%),
    radial-gradient(circle at 50% 43%, #41dda0 0 30%, #10a972 51%, #08704e 72%, #023829 100%) !important;
  box-shadow:
    inset 0 3px 0 rgba(228,255,232,.54),
    inset 0 -11px 15px rgba(0,44,28,.56),
    0 0 0 4px #7b290b,
    0 0 0 7px #d39e35,
    0 0 0 9px rgba(87,24,7,.80),
    0 5px 0 #3b0b08,
    0 11px 18px rgba(0,0,0,.48),
    0 0 23px rgba(43,216,155,.27) !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-spin::before {
  content: "" !important;
  position: absolute !important;
  inset: 9px !important;
  border: 1px solid rgba(238,255,224,.36) !important;
  border-radius: 50% !important;
  box-shadow: inset 0 0 13px rgba(138,255,207,.16) !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-spin > span {
  width: 46% !important;
  border-width: 5px !important;
  border-color: #ffe17b !important;
  border-left-color: transparent !important;
  filter: drop-shadow(0 2px 1px rgba(64,23,1,.56)) !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-spin > span::after {
  border-top-width: 5px !important;
  border-right-width: 5px !important;
  border-top-color: #ffe17b !important;
  border-right-color: #ffe17b !important;
}

/* Turbo / Auto */
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button:not(.gt-premium-bonus-button) {
  position: relative !important;
  width: 56px !important;
  height: 56px !important;
  min-width: 56px !important;
  min-height: 56px !important;
  padding: 0 !important;
  border: 2px solid #bc8934 !important;
  border-radius: 50% !important;
  background:
    radial-gradient(circle at 36% 24%, rgba(255,185,122,.12), transparent 28%),
    radial-gradient(circle at 50% 48%, #4b0d0c 0%, #260507 62%, #0c0609 100%) !important;
  color: #eacb75 !important;
  box-shadow:
    inset 0 2px 0 rgba(255,233,169,.12),
    inset 0 -8px 10px rgba(0,0,0,.40),
    0 0 0 3px #481107,
    0 0 0 5px rgba(190,139,48,.25),
    0 5px 0 #1b0305,
    0 9px 13px rgba(0,0,0,.42) !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button:nth-child(1) { grid-column: 1 !important; grid-row: 1 !important; }
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button:nth-child(3) { grid-column: 5 !important; grid-row: 1 !important; }
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button:not(.gt-premium-bonus-button) > span {
  display: none !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button:not(.gt-premium-bonus-button) > svg {
  width: 22px !important;
  height: 22px !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button:nth-child(3) > strong {
  display: grid !important;
  place-items: center !important;
  min-width: 25px !important;
  height: 25px !important;
  padding: 0 !important;
  border: 1px solid rgba(255,220,126,.28) !important;
  border-radius: 50% !important;
  background: rgba(255,216,104,.08) !important;
  color: #efd27b !important;
  font-size: 13px !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button:first-child.is-active {
  border-color: #f2d26c !important;
  color: #fff1a4 !important;
  background:
    radial-gradient(circle at 50% 40%, #146f5a 0%, #0a493e 48%, #08241f 100%) !important;
  box-shadow:
    inset 0 2px 0 rgba(221,255,241,.20),
    0 0 0 3px #6d2b09,
    0 0 0 5px #d3a13e,
    0 0 16px rgba(49,221,169,.30),
    0 5px 0 #1d0805 !important;
}

/* Physical press */
.gt-hw-page .gt-premium-machine .gt-hw-main-controls > button:not(.gt-hw-spin):not(:disabled):active,
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button:not(.gt-premium-bonus-button):not(:disabled):active {
  transform: translateY(4px) scale(.96) !important;
  box-shadow:
    inset 0 6px 10px rgba(0,0,0,.42),
    0 0 0 3px #481107,
    0 1px 0 #1b0305,
    0 4px 7px rgba(0,0,0,.30) !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-spin:not(:disabled):active {
  transform: translateY(4px) scale(.95) !important;
  box-shadow:
    inset 0 7px 12px rgba(0,55,37,.52),
    0 0 0 4px #7b290b,
    0 0 0 7px #d39e35,
    0 1px 0 #3b0b08,
    0 5px 9px rgba(0,0,0,.38) !important;
}

/* ========================================================================== */
/* BONUS — one obvious purchase button + simple modal                          */
/* ========================================================================== */
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button.gt-premium-bonus-button {
  position: absolute !important;
  z-index: 9 !important;
  left: 50% !important;
  top: -41px !important;
  transform: translateX(-50%) !important;
  width: 146px !important;
  height: 34px !important;
  min-width: 146px !important;
  min-height: 34px !important;
  padding: 0 12px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 7px !important;
  border: 1px solid #f1cb62 !important;
  border-radius: 999px !important;
  background:
    radial-gradient(ellipse at 50% -10%, rgba(255,244,188,.28), transparent 52%),
    linear-gradient(180deg, #a52c17 0%, #671009 58%, #380506 100%) !important;
  color: #fff0a1 !important;
  box-shadow:
    inset 0 1px 0 rgba(255,247,210,.28),
    inset 0 -5px 8px rgba(53,3,2,.30),
    0 2px 0 #4a0b06,
    0 6px 11px rgba(0,0,0,.38),
    0 0 13px rgba(255,183,41,.18) !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button.gt-premium-bonus-button > span {
  display: inline !important;
  font-size: 8.5px !important;
  font-weight: 950 !important;
  letter-spacing: .075em !important;
  line-height: 1 !important;
  white-space: nowrap !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button.gt-premium-bonus-button > svg {
  width: 16px !important;
  height: 16px !important;
  color: #ffe07a !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button.gt-premium-bonus-button:not(:disabled):active {
  transform: translateX(-50%) translateY(2px) scale(.98) !important;
}

.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal > div {
  padding: 20px 18px 18px !important;
  border: 2px solid #e9bc55 !important;
  border-radius: 22px !important;
  background:
    radial-gradient(ellipse at 50% -8%, rgba(255,206,79,.20), transparent 46%),
    linear-gradient(180deg, #4a0b0b 0%, #190408 50%, #09080b 100%) !important;
  box-shadow:
    0 0 0 2px #5d1308,
    0 24px 64px rgba(0,0,0,.82),
    0 0 34px rgba(255,176,37,.16),
    inset 0 1px 0 rgba(255,240,188,.16) !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal > div > span {
  font-size: 8px !important;
  color: #f5ca68 !important;
  letter-spacing: .22em !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal h2 {
  margin: 6px 0 0 !important;
  font: 900 21px/1.05 Georgia, serif !important;
  color: #fff0a7 !important;
  text-shadow: 0 2px 0 #681006 !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-medallion {
  width: 62px !important;
  height: 62px !important;
  margin: 10px auto 9px !important;
  border: 3px solid #f0c75c !important;
  background: radial-gradient(circle at 35% 27%, #fff5ba 0 6%, #e7aa37 8%, #a72a13 58%, #471009 100%) !important;
  color: #fff0a1 !important;
  box-shadow: 0 0 0 3px #5e1908, 0 0 18px rgba(255,184,48,.26) !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-medallion svg {
  width: 27px !important;
  height: 27px !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal p {
  margin-top: 6px !important;
  max-width: 310px !important;
  font-size: 10.5px !important;
  line-height: 1.45 !important;
  color: rgba(255,235,194,.88) !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal dl {
  margin: 12px 0 7px !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal .gt-bonus-cost {
  padding: 11px 13px !important;
  border: 1px solid rgba(241,199,87,.72) !important;
  border-radius: 12px !important;
  background:
    radial-gradient(ellipse at 80% 50%, rgba(255,201,66,.14), transparent 52%),
    rgba(23,7,7,.88) !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal .gt-bonus-cost dt {
  font-size: 8px !important;
  color: #d9ad5d !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal .gt-bonus-cost dd {
  font-size: 16px !important;
  color: #ffe17a !important;
}
.gt-hw-page .gt-premium-machine .gt-bonus-start-note {
  display: block !important;
  margin-top: 7px !important;
  color: rgba(255,225,170,.72) !important;
  font-size: 8px !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal .is-buy {
  border-color: #f2cf6b !important;
  background: linear-gradient(180deg, #15976d, #075f4b) !important;
  color: #f4fff9 !important;
  box-shadow: inset 0 1px 0 rgba(232,255,244,.24), 0 0 13px rgba(40,213,157,.14) !important;
}

@media (max-width: 390px) {
  .gt-hw-page .gt-premium-machine .gt-hw-controls.gt-commercial-console {
    grid-template-columns: 48px 45px 82px 45px 48px !important;
    grid-template-rows: 70px !important;
    gap: 6px !important;
    padding-inline: 5px !important;
  }
  .gt-hw-page .gt-premium-machine .gt-hw-main-controls > button:not(.gt-hw-spin) {
    width: 45px !important;
    height: 45px !important;
    min-width: 45px !important;
    min-height: 45px !important;
    font-size: 26px !important;
  }
  .gt-hw-page .gt-premium-machine .gt-hw-spin {
    width: 82px !important;
    height: 82px !important;
  }
  .gt-hw-page .gt-premium-machine .gt-premium-secondary > button:not(.gt-premium-bonus-button) {
    width: 48px !important;
    height: 48px !important;
    min-width: 48px !important;
    min-height: 48px !important;
  }
  .gt-hw-page .gt-premium-machine .gt-premium-secondary > button.gt-premium-bonus-button {
    width: 136px !important;
    min-width: 136px !important;
    height: 32px !important;
    min-height: 32px !important;
    top: -38px !important;
  }
  .gt-hw-page .gt-premium-machine .gt-hw-win-ribbon { top: 56% !important; }
}

@media (max-height: 780px) {
  .gt-hw-page .gt-premium-machine .gt-hw-controls.gt-commercial-console {
    grid-template-rows: 62px !important;
    padding-block: 5px 7px !important;
  }
  .gt-hw-page .gt-premium-machine .gt-hw-spin { width: 72px !important; height: 72px !important; }
  .gt-hw-page .gt-premium-machine .gt-hw-main-controls > button:not(.gt-hw-spin) { width: 40px !important; height: 40px !important; min-width: 40px !important; min-height: 40px !important; }
  .gt-hw-page .gt-premium-machine .gt-premium-secondary > button:not(.gt-premium-bonus-button) { width: 43px !important; height: 43px !important; min-width: 43px !important; min-height: 43px !important; }
}

@media (prefers-reduced-motion: reduce) {
  .gt-hw-page .gt-premium-machine .gt-premium-grid[data-landing-column] .gt-hw-cell,
  .gt-hw-page .gt-premium-machine .gt-hw-win-ribbon {
    animation: none !important;
  }
}
`;

export function GoldenTigerScene25D({ lighting }: { lighting: GoldenTigerLightingMode }) {
  return (
    <div className="gt-commercial-scene" data-lighting={lighting} aria-hidden>
      <style>{FINAL_POLISH}</style>
      <img className="gt-scene-layer layer-bg-backplate" src={backplate} alt="" draggable={false} />
      <img className="gt-scene-layer layer-bg-architecture" src={architecture} alt="" draggable={false} />
      <img className="gt-scene-layer layer-reels-frame" src={reelsFrame} alt="" draggable={false} />
      <img className="gt-scene-layer layer-mascot-platform" src={mascotPlatform} alt="" draggable={false} />
      <img className="gt-scene-layer layer-foreground" src={foreground} alt="" draggable={false} />
      <span className="gt-scene-light gt-scene-light--ambient" />
      <span className="gt-scene-light gt-scene-light--spot" />
      <span className="gt-scene-particles">
        {SCENE_PARTICLES.map((particle, index) => (
          <i
            key={index}
            style={{
              "--gt-scene-p-left": `${particle.left}%`,
              "--gt-scene-p-top": `${particle.top}%`,
              "--gt-scene-p-delay": `${particle.delay}s`,
              "--gt-scene-p-duration": `${particle.duration}s`,
              "--gt-scene-p-size": `${particle.size}px`,
            } as CSSProperties}
          />
        ))}
      </span>
      <span className="gt-scene-vignette" />
    </div>
  );
}
