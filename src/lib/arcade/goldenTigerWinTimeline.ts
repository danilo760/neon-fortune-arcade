export type GoldenTigerWinBeat = "impact" | "reveal" | "celebrate" | null;

export type GoldenTigerWinTimeline = {
  impactMs: number;
  revealMs: number;
  celebrateMs: number;
};

export function goldenTigerWinTimeline(turbo: boolean, fullGrid: boolean): GoldenTigerWinTimeline {
  if (turbo) {
    return {
      impactMs: 150,
      revealMs: fullGrid ? 650 : 520,
      celebrateMs: fullGrid ? 420 : 320,
    };
  }

  return {
    impactMs: 320,
    revealMs: fullGrid ? 2100 : 1800,
    celebrateMs: fullGrid ? 1100 : 850,
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
    if (kind === "simple-win") return 700;
    if (kind === "return") return 550;
    return 90;
  }

  if (kind === "simple-win") return 1500;
  if (kind === "return") return 1350;
  return 240;
}
