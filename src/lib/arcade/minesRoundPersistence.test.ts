import assert from "node:assert/strict";
import test from "node:test";

import {
  MINES_ROUND_STORAGE_KEY,
  clearMinesRoundSnapshot,
  loadMinesRoundSnapshot,
  normalizeMinesRoundSnapshot,
  saveMinesRoundSnapshot,
  type MinesRoundSnapshot,
} from "./minesRoundPersistence";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
    removeItem(key: string) { values.delete(key); },
  };
}

const snapshot: MinesRoundSnapshot = {
  version: 1,
  bet: 100,
  mineCount: 3,
  mineField: [2, 11, 23],
  revealed: [0, 1, 4],
  startedAt: 1_789_000_000_000,
};

test("Mines round snapshot survives save/load without changing the field", () => {
  const storage = memoryStorage();
  assert.equal(saveMinesRoundSnapshot(snapshot, storage), true);
  assert.deepEqual(loadMinesRoundSnapshot(storage), snapshot);
});

test("Mines round snapshot rejects revealed mines and malformed fields", () => {
  assert.equal(normalizeMinesRoundSnapshot({ ...snapshot, revealed: [0, 2] }), null);
  assert.equal(normalizeMinesRoundSnapshot({ ...snapshot, mineField: [2, 2, 23] }), null);
  assert.equal(normalizeMinesRoundSnapshot({ ...snapshot, mineCount: 5 }), null);
});

test("corrupt persisted round is discarded instead of being resumed", () => {
  const storage = memoryStorage();
  storage.setItem(MINES_ROUND_STORAGE_KEY, "{not-json");
  assert.equal(loadMinesRoundSnapshot(storage), null);
  assert.equal(storage.getItem(MINES_ROUND_STORAGE_KEY), null);
});

test("settled round can be explicitly cleared", () => {
  const storage = memoryStorage();
  saveMinesRoundSnapshot(snapshot, storage);
  clearMinesRoundSnapshot(storage);
  assert.equal(loadMinesRoundSnapshot(storage), null);
});
