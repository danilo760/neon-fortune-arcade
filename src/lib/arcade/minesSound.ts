import { playSound } from "./sound";

export type MinesSoundCategory = "AMBIENT" | "INTERACTION" | "DANGER" | "REWARD";
export type MinesSoundEvent =
  | "button"
  | "tilePress"
  | "unlock"
  | "gemReveal"
  | "multiplierRise"
  | "danger"
  | "mineArm"
  | "explosion"
  | "cashout"
  | "win";

const categoryByEvent: Record<MinesSoundEvent, MinesSoundCategory> = {
  button: "INTERACTION",
  tilePress: "INTERACTION",
  unlock: "INTERACTION",
  gemReveal: "REWARD",
  multiplierRise: "REWARD",
  danger: "DANGER",
  mineArm: "DANGER",
  explosion: "DANGER",
  cashout: "REWARD",
  win: "REWARD",
};

let suppressInteractionUntil = 0;
let suppressAmbientUntil = 0;

function now() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

export function minesSoundCategory(event: MinesSoundEvent) {
  return categoryByEvent[event];
}

export function playMinesSound(event: MinesSoundEvent, enabled: boolean, sequence = 0) {
  if (!enabled) return;
  const current = now();
  const category = categoryByEvent[event];
  if (category === "INTERACTION" && current < suppressInteractionUntil) return;
  if (category === "AMBIENT" && current < suppressAmbientUntil) return;

  if (category === "DANGER") {
    suppressInteractionUntil = current + 420;
    suppressAmbientUntil = current + 520;
  } else if (category === "REWARD") {
    suppressInteractionUntil = Math.max(suppressInteractionUntil, current + 120);
  }

  switch (event) {
    case "button":
      playSound("click", enabled);
      break;
    case "tilePress":
      playSound("minesMetal", enabled);
      break;
    case "unlock":
      playSound("minesUnlock", enabled);
      break;
    case "gemReveal":
      playSound("minesCrystal", enabled, {
        intensity: Math.min(1.08, 0.82 + Math.max(1, sequence) * 0.035),
      });
      break;
    case "multiplierRise":
      if (sequence > 1) playSound("tick", enabled);
      break;
    case "danger":
      playSound("minesDanger", enabled, { intensity: 0.92 });
      break;
    case "mineArm":
      playSound("minesMetal", enabled);
      break;
    case "explosion":
      playSound("minesExplosion", enabled, { intensity: 1.05 });
      break;
    case "cashout":
      playSound("minesCashout", enabled, { intensity: 1.03 });
      break;
    case "win":
      playSound("cash", enabled);
      break;
  }
}
