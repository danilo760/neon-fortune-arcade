export const MINES_ROUND_STORAGE_KEY = "neon-fortune-arcade:mines-round:v1";

export type MinesRoundSnapshot = {
  version: 1;
  bet: number;
  mineCount: number;
  mineField: number[];
  revealed: number[];
  startedAt: number;
};

type MinesRoundStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function validIndex(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) < 25;
}

function uniqueIndexes(value: unknown): number[] | null {
  if (!Array.isArray(value) || !value.every(validIndex)) return null;
  const normalized = value.map(Number);
  return new Set(normalized).size === normalized.length ? normalized : null;
}

export function normalizeMinesRoundSnapshot(value: unknown): MinesRoundSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<MinesRoundSnapshot>;
  if (input.version !== 1) return null;
  if (!Number.isFinite(input.bet) || Number(input.bet) <= 0) return null;
  if (!Number.isInteger(input.mineCount) || Number(input.mineCount) < 1 || Number(input.mineCount) > 24) return null;
  if (!Number.isFinite(input.startedAt) || Number(input.startedAt) <= 0) return null;

  const mineField = uniqueIndexes(input.mineField);
  const revealed = uniqueIndexes(input.revealed);
  if (!mineField || !revealed) return null;
  if (mineField.length !== Number(input.mineCount)) return null;
  if (revealed.length > 25 - Number(input.mineCount)) return null;

  const mines = new Set(mineField);
  if (revealed.some((index) => mines.has(index))) return null;

  return {
    version: 1,
    bet: Number(input.bet),
    mineCount: Number(input.mineCount),
    mineField,
    revealed,
    startedAt: Number(input.startedAt),
  };
}

export function loadMinesRoundSnapshot(storage: MinesRoundStorage | null = typeof window === "undefined" ? null : window.localStorage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(MINES_ROUND_STORAGE_KEY);
    if (!raw) return null;
    const normalized = normalizeMinesRoundSnapshot(JSON.parse(raw));
    if (!normalized) storage.removeItem(MINES_ROUND_STORAGE_KEY);
    return normalized;
  } catch {
    storage.removeItem(MINES_ROUND_STORAGE_KEY);
    return null;
  }
}

export function saveMinesRoundSnapshot(snapshot: MinesRoundSnapshot, storage: MinesRoundStorage | null = typeof window === "undefined" ? null : window.localStorage) {
  if (!storage) return false;
  const normalized = normalizeMinesRoundSnapshot(snapshot);
  if (!normalized) return false;
  storage.setItem(MINES_ROUND_STORAGE_KEY, JSON.stringify(normalized));
  return true;
}

export function clearMinesRoundSnapshot(storage: MinesRoundStorage | null = typeof window === "undefined" ? null : window.localStorage) {
  storage?.removeItem(MINES_ROUND_STORAGE_KEY);
}
