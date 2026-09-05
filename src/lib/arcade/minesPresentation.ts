export type MinesRiskLevel = "low" | "medium" | "high" | "extreme";

export const MINES_PRESENTATION_TIMING = Object.freeze({
  press: 60,
  unlock: 82,
  gemSettle: 205,
  possibleWinCount: 260,
  danger: 92,
  explosion: 190,
  lostSettle: 55,
  cashoutPress: 90,
  cashoutCount: 300,
  cashoutSettle: 80,
});

export const MINES_SAFE_REVEAL_BUDGET =
  MINES_PRESENTATION_TIMING.press +
  MINES_PRESENTATION_TIMING.unlock +
  MINES_PRESENTATION_TIMING.gemSettle;

export const MINES_MINE_REVEAL_BUDGET =
  MINES_PRESENTATION_TIMING.press +
  MINES_PRESENTATION_TIMING.unlock +
  MINES_PRESENTATION_TIMING.danger +
  MINES_PRESENTATION_TIMING.explosion;

export const MINES_CASHOUT_BUDGET =
  MINES_PRESENTATION_TIMING.cashoutPress +
  MINES_PRESENTATION_TIMING.cashoutCount +
  MINES_PRESENTATION_TIMING.cashoutSettle;

export function minesPresentationDelay(duration: number, reduceMotion: boolean) {
  return reduceMotion ? 0 : duration;
}

export function minesRiskLevel(mineCount: number): MinesRiskLevel {
  if (mineCount <= 1) return "low";
  if (mineCount <= 3) return "medium";
  if (mineCount <= 5) return "high";
  return "extreme";
}

export function minesRiskLabel(mineCount: number) {
  const level = minesRiskLevel(mineCount);
  if (level === "low") return "BAIXO";
  if (level === "medium") return "MÉDIO";
  if (level === "high") return "ALTO";
  return "EXTREMO";
}
