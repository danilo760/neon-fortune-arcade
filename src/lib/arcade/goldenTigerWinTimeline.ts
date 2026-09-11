export type GoldenTigerWinBeat = "impact" | "reveal" | "celebrate" | null;

export type GoldenTigerWinTimeline = {
  impactMs: number;
  revealMs: number;
  celebrateMs: number;
};

export function goldenTigerWinTimeline(turbo: boolean, fullGrid: boolean): GoldenTigerWinTimeline {
  if (turbo) {
    return {
      impactMs: 180,
      revealMs: fullGrid ? 820 : 680,
      celebrateMs: fullGrid ? 560 : 430,
    };
  }

  return {
    impactMs: 380,
    revealMs: fullGrid ? 2700 : 2300,
    celebrateMs: fullGrid ? 1450 : 1150,
  };
}

export type GoldenTigerSettlePresentation = "simple-win" | "return" | "lose";

/**
 * Winning amounts need to remain on screen long enough to be read on mobile.
 * Even a return at or below stake is presented as a visible result before the
 * game returns to idle. Turbo stays quicker but never flashes the payout away.
 */
export function goldenTigerSettleHoldMs(kind: GoldenTigerSettlePresentation, turbo: boolean) {
  if (turbo) {
    if (kind === "simple-win") return 900;
    if (kind === "return") return 720;
    return 130;
  }

  if (kind === "simple-win") return 1900;
  if (kind === "return") return 1700;
  return 320;
}
