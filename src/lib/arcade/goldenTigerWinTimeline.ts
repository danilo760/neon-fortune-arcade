export type GoldenTigerWinBeat = "impact" | "reveal" | "celebrate" | null;

export type GoldenTigerWinTimeline = {
  impactMs: number;
  revealMs: number;
  celebrateMs: number;
};

export function goldenTigerWinTimeline(turbo: boolean, fullGrid: boolean): GoldenTigerWinTimeline {
  if (turbo) {
    return { impactMs: 110, revealMs: fullGrid ? 420 : 330, celebrateMs: fullGrid ? 300 : 220 };
  }
  return {
    impactMs: 250,
    revealMs: fullGrid ? 1750 : 1500,
    celebrateMs: fullGrid ? 900 : 650,
  };
}

export type GoldenTigerSettlePresentation = "simple-win" | "return" | "lose";

export function goldenTigerSettleHoldMs(kind: GoldenTigerSettlePresentation, turbo: boolean) {
  if (turbo) return kind === "simple-win" ? 280 : kind === "return" ? 90 : 70;
  return kind === "simple-win" ? 650 : kind === "return" ? 260 : 170;
}
