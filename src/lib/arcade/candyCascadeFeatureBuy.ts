import { CANDY_FEATURE_BUY_INITIAL_SPINS } from "./candyCascadeMath";

// Calibrated from Candy's own 1,000,000-purchase Sugar Party Monte Carlo.
// 13.47286564x average win / 14.1x cost ~= 95.55% fictitious feature return.
export const CANDY_FEATURE_BUY_COST_MULTIPLIER = 14.1;

export function candyFeatureBuyCost(bet: number) {
  if (!Number.isFinite(bet) || bet <= 0) return 0;
  return Math.round(bet * CANDY_FEATURE_BUY_COST_MULTIPLIER);
}

export type CandyFeatureBuyBlockReason =
  | "insufficientBalance"
  | "spinning"
  | "bonusActive"
  | "autoplayActive"
  | "pending"
  | "modalProcessing"
  | null;

export type CandyFeatureBuyAvailabilityInput = {
  balance: number;
  bet: number;
  spinning: boolean;
  bonusActive: boolean;
  autoLeft: number;
  pending: boolean;
  modalProcessing?: boolean;
};

export function candyFeatureBuyAvailability(input: CandyFeatureBuyAvailabilityInput) {
  const cost = candyFeatureBuyCost(input.bet);
  let reason: CandyFeatureBuyBlockReason = null;

  if (input.pending) reason = "pending";
  else if (input.modalProcessing) reason = "modalProcessing";
  else if (input.bonusActive) reason = "bonusActive";
  else if (input.spinning) reason = "spinning";
  else if (input.autoLeft > 0) reason = "autoplayActive";
  else if (cost <= 0 || input.balance < cost) reason = "insufficientBalance";

  return { allowed: reason === null, reason, cost };
}

export type CandyFeaturePurchaseLock = {
  acquire: () => boolean;
  release: () => void;
  isLocked: () => boolean;
};

export function createCandyFeaturePurchaseLock(): CandyFeaturePurchaseLock {
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

export type CandyFeaturePurchase = {
  cost: number;
  initialSpins: number;
};

export function createCandyFeaturePurchase(bet: number): CandyFeaturePurchase {
  return {
    cost: candyFeatureBuyCost(bet),
    initialSpins: CANDY_FEATURE_BUY_INITIAL_SPINS,
  };
}
