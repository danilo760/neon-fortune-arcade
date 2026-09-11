export type GoldenTigerWinBeat = "impact" | "reveal" | "celebrate" | null;

export type GoldenTigerWinTimeline = {
  impactMs: number;
  revealMs: number;
  celebrateMs: number;
};

export function goldenTigerWinTimeline(turbo: boolean, fullGrid: boolean): GoldenTigerWinTimeline {
  if (turbo) {
    return {
      impactMs: 260,
      revealMs: fullGrid ? 1_180 : 980,
      celebrateMs: fullGrid ? 760 : 620,
    };
  }

  return {
    impactMs: 560,
    revealMs: fullGrid ? 3_250 : 2_850,
    celebrateMs: fullGrid ? 1_850 : 1_550,
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
    if (kind === "simple-win") return 1_200;
    if (kind === "return") return 980;
    return 180;
  }

  if (kind === "simple-win") return 2_400;
  if (kind === "return") return 2_100;
  return 420;
}
