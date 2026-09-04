import { OLYMPUS_FEATURE_BUY_INITIAL_SPINS, olympusFeatureBuyCost } from "./olympusStormMath";

export type OlympusFeatureBuyBlockReason =
  | "insufficientBalance"
  | "spinning"
  | "bonusActive"
  | "autoplayActive"
  | "modalOpen"
  | "pending"
  | null;

export type OlympusFeatureBuyAvailabilityInput = {
  balance: number;
  bet: number;
  spinning: boolean;
  bonusActive: boolean;
  autoLeft: number;
  modalOpen: boolean;
  pending: boolean;
};

export function olympusFeatureBuyAvailability(input: OlympusFeatureBuyAvailabilityInput) {
  const cost = olympusFeatureBuyCost(input.bet);
  let reason: OlympusFeatureBuyBlockReason = null;

  if (input.pending) reason = "pending";
  else if (input.modalOpen) reason = "modalOpen";
  else if (input.bonusActive) reason = "bonusActive";
  else if (input.spinning) reason = "spinning";
  else if (input.autoLeft > 0) reason = "autoplayActive";
  else if (cost <= 0 || input.balance < cost) reason = "insufficientBalance";

  return { allowed: reason === null, reason, cost };
}

export type OlympusFeatureBuyLock = {
  acquire: () => boolean;
  release: () => void;
  isLocked: () => boolean;
};

export function createOlympusFeatureBuyLock(): OlympusFeatureBuyLock {
  let locked = false;
  return {
    acquire() {
      if (locked) return false;
      locked = true;
      return true;
    },
    release() {
      locked = false;
    },
    isLocked() {
      return locked;
    },
  };
}

export function olympusFeatureBuyInitialSpins() {
  return OLYMPUS_FEATURE_BUY_INITIAL_SPINS;
}
