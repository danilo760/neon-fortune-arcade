import {
  GOLDEN_TIGER_FEATURE_BUY_INITIAL_SPINS,
  GOLDEN_TIGER_MAX_RETRIGGERS,
  goldenTigerFeatureBuyCost,
} from "./goldenTigerMath";

export type GoldenFortuneBlockReason =
  | "insufficientBalance"
  | "spinning"
  | "bonusActive"
  | "autoplayActive"
  | "pending"
  | null;

export type GoldenFortuneAvailabilityInput = {
  balance: number;
  bet: number;
  spinning: boolean;
  bonusActive: boolean;
  autoLeft: number;
  pending: boolean;
};

export function goldenFortuneAvailability(input: GoldenFortuneAvailabilityInput) {
  const cost = goldenTigerFeatureBuyCost(input.bet);
  let reason: GoldenFortuneBlockReason = null;

  if (input.pending) reason = "pending";
  else if (input.bonusActive) reason = "bonusActive";
  else if (input.spinning) reason = "spinning";
  else if (input.autoLeft > 0) reason = "autoplayActive";
  else if (cost <= 0 || input.balance < cost) reason = "insufficientBalance";

  return { allowed: reason === null, reason, cost };
}

export type GoldenFortunePurchaseLock = {
  acquire: () => boolean;
  release: () => void;
  isLocked: () => boolean;
};

export function createGoldenFortunePurchaseLock(): GoldenFortunePurchaseLock {
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

export type GoldenFortuneSession = {
  cost: number;
  initialSpins: number;
  spinsLeft: number;
  retriggers: number;
};

export function createGoldenFortuneSession(bet: number): GoldenFortuneSession {
  return {
    cost: goldenTigerFeatureBuyCost(bet),
    initialSpins: GOLDEN_TIGER_FEATURE_BUY_INITIAL_SPINS,
    spinsLeft: GOLDEN_TIGER_FEATURE_BUY_INITIAL_SPINS,
    retriggers: 0,
  };
}

export function applyGoldenFortuneRetrigger(
  session: GoldenFortuneSession,
  award: number,
): GoldenFortuneSession {
  if (award <= 0 || session.retriggers >= GOLDEN_TIGER_MAX_RETRIGGERS) return session;
  return {
    ...session,
    spinsLeft: session.spinsLeft + award,
    retriggers: session.retriggers + 1,
  };
}
