import { useCallback, useSyncExternalStore } from "react";

export const STARTING_BALANCE = 1_000_000;
export const TOPUP_AMOUNT = 500_000;
const STORAGE_KEY = "lucky-neon-arcade:v1";
const MAX_HISTORY = 40;

export interface HistoryEntry {
  id: string;
  slug: string;
  gameName: string;
  bet: number;
  payout: number;
  multiplier: number;
  at: number;
  note?: string;
}

export interface ArcadeState {
  balance: number;
  favorites: string[];
  soundEnabled: boolean;
  history: HistoryEntry[];
  totalSpins: number;
  bestWin: number;
}

const defaultState: ArcadeState = {
  balance: STARTING_BALANCE,
  favorites: [],
  soundEnabled: false,
  history: [],
  totalSpins: 0,
  bestWin: 0,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Defensive parse: any malformed field falls back to its default. */
export function parseState(raw: unknown): ArcadeState {
  if (typeof raw !== "object" || raw === null) return { ...defaultState };
  const data = raw as Record<string, unknown>;
  const history = Array.isArray(data["history"])
    ? data["history"]
        .filter(
          (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
        )
        .map((item) => ({
          id: typeof item["id"] === "string" ? item["id"] : Math.random().toString(36).slice(2),
          slug: typeof item["slug"] === "string" ? item["slug"] : "unknown",
          gameName: typeof item["gameName"] === "string" ? item["gameName"] : "Jogo",
          bet: isFiniteNumber(item["bet"]) ? item["bet"] : 0,
          payout: isFiniteNumber(item["payout"]) ? item["payout"] : 0,
          multiplier: isFiniteNumber(item["multiplier"]) ? item["multiplier"] : 0,
          at: isFiniteNumber(item["at"]) ? item["at"] : Date.now(),
          ...(typeof item["note"] === "string" ? { note: item["note"] } : {}),
        }))
        .slice(0, MAX_HISTORY)
    : [];

  return {
    balance: isFiniteNumber(data["balance"])
      ? Math.max(0, Math.floor(data["balance"]))
      : STARTING_BALANCE,
    favorites: Array.isArray(data["favorites"])
      ? data["favorites"].filter((item): item is string => typeof item === "string")
      : [],
    soundEnabled: typeof data["soundEnabled"] === "boolean" ? data["soundEnabled"] : false,
    history,
    totalSpins: isFiniteNumber(data["totalSpins"])
      ? Math.max(0, Math.floor(data["totalSpins"]))
      : 0,
    bestWin: isFiniteNumber(data["bestWin"]) ? Math.max(0, Math.floor(data["bestWin"])) : 0,
  };
}

let state: ArcadeState = { ...defaultState };
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — keep in-memory state */
  }
}

function setState(patch: Partial<ArcadeState>) {
  state = { ...state, ...patch };
  persist();
  emit();
}

export function hydrateFromStorage() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    state = raw ? parseState(JSON.parse(raw) as unknown) : { ...defaultState };
  } catch {
    state = { ...defaultState };
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ArcadeState {
  return state;
}

function getServerSnapshot(): ArcadeState {
  return defaultState;
}

export function useArcade<T>(selector: (s: ArcadeState) => T): T {
  const select = useCallback(() => selector(getSnapshot()), [selector]);
  const selectServer = useCallback(() => selector(getServerSnapshot()), [selector]);
  return useSyncExternalStore(subscribe, select, selectServer);
}

export const arcadeActions = {
  addCoins(amount = TOPUP_AMOUNT) {
    setState({ balance: Math.max(STARTING_BALANCE, state.balance + amount) });
  },
  refillToStart() {
    setState({ balance: Math.max(state.balance, STARTING_BALANCE) });
  },
  /** Debits fictional coins once without counting the action as a normal spin. */
  debitCoins(amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0 || amount > state.balance) return false;
    setState({ balance: state.balance - Math.round(amount) });
    return true;
  },
  /** Returns false when the balance cannot cover the bet. */
  placeBet(amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0 || amount > state.balance) return false;
    setState({ balance: state.balance - amount, totalSpins: state.totalSpins + 1 });
    return true;
  },
  credit(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setState({ balance: state.balance + Math.round(amount) });
  },
  recordRound(entry: Omit<HistoryEntry, "id" | "at">) {
    const full: HistoryEntry = {
      ...entry,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      at: Date.now(),
    };
    setState({
      history: [full, ...state.history].slice(0, MAX_HISTORY),
      bestWin: Math.max(state.bestWin, Math.round(entry.payout)),
    });
  },
  toggleFavorite(slug: string) {
    setState({
      favorites: state.favorites.includes(slug)
        ? state.favorites.filter((item) => item !== slug)
        : [...state.favorites, slug],
    });
  },
  toggleSound() {
    setState({ soundEnabled: !state.soundEnabled });
  },
  clearHistory() {
    setState({ history: [] });
  },
  resetAll() {
    state = { ...defaultState };
    persist();
    emit();
  },
  getBalance() {
    return state.balance;
  },
};