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
