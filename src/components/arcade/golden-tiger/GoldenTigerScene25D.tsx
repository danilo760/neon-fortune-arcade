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
 * Final approved polish lives with the existing scene instead of creating a
 * second Golden Tiger version or another stylesheet chain. Presentation only:
 * no outcome, RNG, RTP, bet, payout or settlement logic is changed here.
 */
const FINAL_POLISH = String.raw`
/* --------------------------------------------------------------------------
   REEL LANDING — symbols visibly fall, hit the stop and settle with weight.
   data-landing-column is set before the deterministic brake; the delays align
   the static symbol impact with the moment the moving reel overlay disappears.
   -------------------------------------------------------------------------- */
.gt-hw-page .gt-premium-machine .gt-premium-grid[data-landing-column="0"] .gt-hw-cell:nth-child(3n+1) {
  animation: gt-final-symbol-land .38s cubic-bezier(.12,.78,.18,1.16) .65s both !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-grid[data-landing-column="1"] .gt-hw-cell:nth-child(3n+2) {
  animation: gt-final-symbol-land .39s cubic-bezier(.12,.78,.18,1.16) .76s both !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-grid[data-landing-column="2"] .gt-hw-cell:nth-child(3n+3) {
  animation: gt-final-symbol-land .40s cubic-bezier(.12,.78,.18,1.16) .88s both !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-grid[data-landing-column="0"] .gt-commercial-reel-cylinder.is-0 {
  animation: gt-final-cylinder-hit .38s cubic-bezier(.14,.76,.2,1.14) .65s both !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-grid[data-landing-column="1"] .gt-commercial-reel-cylinder.is-1 {
  animation: gt-final-cylinder-hit .39s cubic-bezier(.14,.76,.2,1.14) .76s both !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-grid[data-landing-column="2"] .gt-commercial-reel-cylinder.is-2 {
  animation: gt-final-cylinder-hit .40s cubic-bezier(.14,.76,.2,1.14) .88s both !important;
}

/* Turbo stays fast, but still has a visible hit instead of snapping instantly. */
.gt-hw-page .gt-premium-machine:has(.gt-premium-secondary > button:first-child.is-active) .gt-premium-grid[data-landing-column="0"] .gt-hw-cell:nth-child(3n+1),
.gt-hw-page .gt-premium-machine:has(.gt-premium-secondary > button:first-child.is-active) .gt-premium-grid[data-landing-column="0"] .gt-commercial-reel-cylinder.is-0 {
  animation-delay: .14s !important;
  animation-duration: .13s !important;
}
.gt-hw-page .gt-premium-machine:has(.gt-premium-secondary > button:first-child.is-active) .gt-premium-grid[data-landing-column="1"] .gt-hw-cell:nth-child(3n+2),
.gt-hw-page .gt-premium-machine:has(.gt-premium-secondary > button:first-child.is-active) .gt-premium-grid[data-landing-column="1"] .gt-commercial-reel-cylinder.is-1 {
  animation-delay: .17s !important;
  animation-duration: .13s !important;
}
.gt-hw-page .gt-premium-machine:has(.gt-premium-secondary > button:first-child.is-active) .gt-premium-grid[data-landing-column="2"] .gt-hw-cell:nth-child(3n+3),
.gt-hw-page .gt-premium-machine:has(.gt-premium-secondary > button:first-child.is-active) .gt-premium-grid[data-landing-column="2"] .gt-commercial-reel-cylinder.is-2 {
  animation-delay: .20s !important;
  animation-duration: .14s !important;
}

@keyframes gt-final-symbol-land {
  0% {
    opacity: .70;
    transform: translate3d(0,-18px,0) scaleY(1.045) scaleX(.99);
    filter: brightness(.92) saturate(.96);
  }
  44% {
    opacity: 1;
    transform: translate3d(0,5px,0) scaleY(.955) scaleX(1.012);
    filter: brightness(1.18) saturate(1.06);
  }
  68% {
    transform: translate3d(0,-3px,0) scaleY(1.022) scaleX(.997);
    filter: brightness(1.07);
  }
  84% {
    transform: translate3d(0,1px,0) scaleY(.992);
  }
  100% {
    opacity: 1;
    transform: translate3d(0,0,0) scale(1);
    filter: brightness(1);
  }
}

@keyframes gt-final-cylinder-hit {
  0%,100% { transform: translateY(0) scaleY(1); filter: brightness(1); }
  44% { transform: translateY(3px) scaleY(.985); filter: brightness(1.10); }
  70% { transform: translateY(-1px) scaleY(1.008); filter: brightness(1.04); }
}

/* --------------------------------------------------------------------------
   PAYOUT READABILITY — every positive result has a readable amount window.
   Small/nice wins use the existing ribbon; large wins keep their existing
   cinematic stage. Returns get a compact central result plaque instead of a
   tiny HUD message.
   -------------------------------------------------------------------------- */
.gt-hw-page .gt-premium-machine .gt-hw-win-ribbon {
  top: 58% !important;
  width: min(86%, 360px) !important;
  min-height: 96px !important;
  padding: 13px 20px 15px !important;
  border: 2px solid rgba(255,232,139,.96) !important;
  border-radius: 22px !important;
  background:
    radial-gradient(ellipse at 50% 0%, rgba(255,235,151,.28), transparent 48%),
    linear-gradient(180deg, rgba(111,16,9,.985), rgba(39,3,4,.985)) !important;
  box-shadow:
    0 16px 34px rgba(0,0,0,.68),
    0 0 0 2px rgba(112,31,7,.82),
    0 0 30px rgba(255,196,61,.30),
    inset 0 1px 0 rgba(255,248,207,.30) !important;
  animation:
    gt-final-payout-enter .38s cubic-bezier(.16,.84,.2,1.12) both,
    gt-final-payout-glow 1.15s ease-in-out .40s infinite alternate !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-win-ribbon > span:first-child {
  font-size: 13px !important;
  letter-spacing: .18em !important;
  color: #ffd971 !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-win-ribbon > span + span {
  margin-top: 5px !important;
  font-size: clamp(32px, 10vw, 45px) !important;
  line-height: 1 !important;
  color: #fff4bf !important;
  text-shadow: 0 3px 0 #721006, 0 0 16px rgba(255,218,101,.58) !important;
}

.gt-hw-page .gt-premium-machine[data-phase="return"] .gt-hw-status {
  position: absolute !important;
  z-index: 73 !important;
  left: 50% !important;
  top: 59% !important;
  transform: translate(-50%,-50%) !important;
  width: min(82%, 340px) !important;
  min-height: 62px !important;
  padding: 8px 15px !important;
  border: 2px solid rgba(255,221,117,.88) !important;
  border-radius: 18px !important;
  background:
    radial-gradient(ellipse at 50% 0%, rgba(255,220,116,.20), transparent 55%),
    linear-gradient(180deg, rgba(88,12,8,.97), rgba(35,3,4,.98)) !important;
  box-shadow:
    0 14px 30px rgba(0,0,0,.60),
    0 0 22px rgba(255,184,48,.24),
    inset 0 1px 0 rgba(255,239,177,.22) !important;
  pointer-events: none;
  animation: gt-final-payout-enter .34s cubic-bezier(.16,.84,.2,1.12) both !important;
}
.gt-hw-page .gt-premium-machine[data-phase="return"] .gt-hw-status span {
  font-size: clamp(14px,4.4vw,19px) !important;
  font-weight: 950 !important;
  letter-spacing: .09em !important;
  color: #fff1a8 !important;
}

@keyframes gt-final-payout-enter {
  0% { opacity: 0; transform: translate(-50%,-43%) scale(.82); }
  58% { opacity: 1; transform: translate(-50%,-51%) scale(1.035); }
  100% { opacity: 1; transform: translate(-50%,-50%) scale(1); }
}
@keyframes gt-final-payout-glow {
  from { filter: brightness(1); }
  to { filter: brightness(1.06) saturate(1.05); }
}

/* --------------------------------------------------------------------------
   FUTURE-PREMIUM CONTROL DECK — same approved layout, richer materials only.
   -------------------------------------------------------------------------- */
.gt-hw-page .gt-premium-machine .gt-hw-controls.gt-commercial-console {
  border-top-color: rgba(240,197,99,.70) !important;
  background:
    linear-gradient(90deg, rgba(31,8,10,.98), rgba(16,13,17,.995) 23% 77%, rgba(31,8,10,.98)),
    radial-gradient(ellipse at 50% -18%, rgba(54,228,186,.13), transparent 48%) !important;
  box-shadow:
    inset 0 2px 0 rgba(255,232,159,.10),
    inset 0 -12px 19px rgba(0,0,0,.42),
    0 9px 17px rgba(0,0,0,.36),
    0 -1px 12px rgba(45,208,171,.06) !important;
}

.gt-hw-page .gt-premium-machine .gt-hw-main-controls > button:not(.gt-hw-spin) {
  border: 2px solid #b98739 !important;
  background:
    radial-gradient(circle at 36% 24%, rgba(121,226,207,.15), transparent 28%),
    linear-gradient(180deg, #302d31 0%, #19171c 54%, #09090c 100%) !important;
  color: #f5d781 !important;
  text-shadow: 0 0 7px rgba(69,225,190,.16) !important;
  box-shadow:
    inset 0 2px 0 rgba(255,240,192,.14),
    inset 0 -7px 9px rgba(0,0,0,.48),
    0 0 0 2px #4e1708,
    0 4px 0 #1a0707,
    0 7px 12px rgba(0,0,0,.44),
    0 0 9px rgba(48,209,175,.08) !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-main-controls > button:not(.gt-hw-spin)::after {
  content: "";
  position: absolute;
  inset: 5px;
  border-radius: 50%;
  border: 1px solid rgba(80,222,192,.12);
  pointer-events: none;
}

.gt-hw-page .gt-premium-machine .gt-hw-spin {
  border-color: #f2d063 !important;
  background:
    radial-gradient(circle at 34% 24%, rgba(236,255,244,.92) 0 3%, rgba(123,255,220,.24) 5% 10%, transparent 12%),
    radial-gradient(circle at 50% 43%, #4af0ba 0 28%, #12b98b 48%, #06745f 69%, #022f32 100%) !important;
  box-shadow:
    inset 0 3px 0 rgba(224,255,242,.56),
    inset 0 -10px 14px rgba(0,37,39,.58),
    0 0 0 4px #6c2b09,
    0 0 0 6px rgba(33,225,184,.13),
    0 5px 0 #2b0c08,
    0 10px 18px rgba(0,0,0,.48),
    0 0 24px rgba(37,231,185,.28),
    0 0 38px rgba(255,203,76,.13) !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-spin::before {
  inset: 7px !important;
  border-color: rgba(242,255,224,.30) !important;
  box-shadow: inset 0 0 14px rgba(114,255,217,.18), 0 0 8px rgba(71,234,190,.14) !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-spin:not(:disabled):hover {
  filter: brightness(1.08) saturate(1.08) !important;
}

.gt-hw-page .gt-premium-machine .gt-premium-secondary > button:not(.gt-premium-bonus-button) {
  border: 2px solid rgba(178,135,59,.80) !important;
  background:
    radial-gradient(circle at 40% 25%, rgba(71,214,190,.13), transparent 30%),
    linear-gradient(180deg, #29262d, #100f14 72%) !important;
  color: #e7cd83 !important;
  box-shadow:
    inset 0 2px 0 rgba(255,236,180,.10),
    inset 0 -7px 10px rgba(0,0,0,.42),
    0 0 0 2px #421306,
    0 4px 0 #180606,
    0 7px 11px rgba(0,0,0,.40) !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button:first-child.is-active {
  border-color: rgba(98,245,211,.90) !important;
  color: #baffea !important;
  background: radial-gradient(circle at 50% 40%, #176f62, #0a2a2c 72%) !important;
  box-shadow:
    inset 0 1px 0 rgba(219,255,246,.25),
    0 0 0 2px rgba(224,180,72,.46),
    0 0 15px rgba(54,235,195,.35),
    0 4px 0 #151005 !important;
}

/* Bonus is intentionally distinct and readable instead of a mystery icon. */
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button.gt-premium-bonus-button {
  top: -42px !important;
  width: 86px !important;
  height: 32px !important;
  min-width: 86px !important;
  min-height: 32px !important;
  padding: 0 9px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 5px !important;
  border: 1px solid rgba(255,217,111,.88) !important;
  border-radius: 10px !important;
  background:
    radial-gradient(ellipse at 50% 0%, rgba(255,239,171,.26), transparent 52%),
    linear-gradient(180deg, #8e4212, #4d1608 72%) !important;
  color: #fff0ad !important;
  box-shadow:
    inset 0 1px 0 rgba(255,247,205,.30),
    inset 0 -5px 7px rgba(76,15,3,.36),
    0 2px 0 #421006,
    0 5px 10px rgba(0,0,0,.36),
    0 0 10px rgba(255,193,60,.16) !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button.gt-premium-bonus-button > span {
  display: inline !important;
  font-size: 7px !important;
  font-weight: 950 !important;
  letter-spacing: .08em !important;
  line-height: 1 !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button.gt-premium-bonus-button > svg {
  width: 15px !important;
  height: 15px !important;
  color: #ffe080 !important;
}

/* --------------------------------------------------------------------------
   BONUS MODAL — clear cost, clear mechanic, clear action.
   -------------------------------------------------------------------------- */
.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal > div {
  border-color: rgba(255,215,107,.90) !important;
  background:
    radial-gradient(ellipse at 50% -5%, rgba(255,209,94,.24), transparent 44%),
    linear-gradient(180deg, #391013 0%, #151017 52%, #09080c 100%) !important;
  box-shadow:
    0 0 0 2px rgba(98,28,8,.82),
    0 22px 60px rgba(0,0,0,.78),
    0 0 36px rgba(255,181,43,.18),
    inset 0 1px 0 rgba(255,243,192,.18) !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal > div > span {
  color: #6af0cf !important;
  letter-spacing: .18em !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal h2 {
  margin-top: 7px !important;
  font-size: 19px !important;
  color: #fff1b1 !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal p {
  max-width: 320px !important;
  color: rgba(255,238,199,.90) !important;
  font-size: 10.5px !important;
  line-height: 1.5 !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal dl > div {
  border-color: rgba(191,151,74,.30) !important;
  background: rgba(8,9,12,.62) !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal dl > div:nth-child(2) {
  border-color: rgba(255,211,97,.76) !important;
  background:
    radial-gradient(ellipse at 80% 50%, rgba(255,198,58,.13), transparent 52%),
    linear-gradient(90deg, rgba(71,30,8,.78), rgba(25,15,14,.84)) !important;
  box-shadow: inset 0 0 12px rgba(255,190,48,.08), 0 0 10px rgba(255,183,40,.06) !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal dl > div:nth-child(2) dd {
  font-size: 13px !important;
  color: #ffe183 !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal .is-buy {
  position: relative !important;
  border-color: rgba(255,222,121,.92) !important;
  background: linear-gradient(180deg, #25a981, #0b6658) !important;
  color: #effff7 !important;
  box-shadow: inset 0 1px 0 rgba(227,255,246,.28), 0 0 14px rgba(54,226,190,.18) !important;
  font-size: 0 !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-bonus-modal .is-buy::after {
  content: "COMPRAR BÔNUS";
  font-size: 11px;
  font-weight: 950;
  letter-spacing: .05em;
}

@media (max-width: 390px) {
  .gt-hw-page .gt-premium-machine .gt-premium-secondary > button.gt-premium-bonus-button {
    width: 76px !important;
    min-width: 76px !important;
    height: 29px !important;
    min-height: 29px !important;
    top: -39px !important;
    padding-inline: 6px !important;
  }
  .gt-hw-page .gt-premium-machine .gt-hw-win-ribbon { top: 57% !important; }
  .gt-hw-page .gt-premium-machine[data-phase="return"] .gt-hw-status { top: 57% !important; }
}

@media (prefers-reduced-motion: reduce) {
  .gt-hw-page .gt-premium-machine .gt-premium-grid[data-landing-column] .gt-hw-cell,
  .gt-hw-page .gt-premium-machine .gt-premium-grid[data-landing-column] .gt-commercial-reel-cylinder,
  .gt-hw-page .gt-premium-machine .gt-hw-win-ribbon,
  .gt-hw-page .gt-premium-machine[data-phase="return"] .gt-hw-status {
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
