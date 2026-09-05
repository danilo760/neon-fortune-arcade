import assert from "node:assert/strict";
import test from "node:test";

import {
  MINES_CASHOUT_BUDGET,
  MINES_MINE_REVEAL_BUDGET,
  MINES_PRESENTATION_TIMING,
  MINES_SAFE_REVEAL_BUDGET,
  minesPresentationDelay,
  minesRiskLabel,
  minesRiskLevel,
} from "./minesPresentation";

test("safe reveal pacing stays inside the requested 320-420 ms budget", () => {
  assert.equal(MINES_SAFE_REVEAL_BUDGET, 347);
  assert.ok(MINES_SAFE_REVEAL_BUDGET >= 320);
  assert.ok(MINES_SAFE_REVEAL_BUDGET <= 420);
});

test("mine reveal stays fast while preserving danger and explosion phases", () => {
  assert.equal(MINES_MINE_REVEAL_BUDGET, 424);
  assert.ok(MINES_PRESENTATION_TIMING.danger > 0);
  assert.ok(MINES_PRESENTATION_TIMING.explosion > 0);
  assert.ok(MINES_MINE_REVEAL_BUDGET >= 400);
  assert.ok(MINES_MINE_REVEAL_BUDGET <= 550);
});

test("cashout pacing stays inside the requested reward window", () => {
  assert.equal(MINES_CASHOUT_BUDGET, 470);
  assert.ok(MINES_CASHOUT_BUDGET >= 450);
  assert.ok(MINES_CASHOUT_BUDGET <= 650);
});

test("reduced motion removes presentation waits without changing timing constants", () => {
  for (const duration of Object.values(MINES_PRESENTATION_TIMING)) {
    assert.equal(minesPresentationDelay(duration, true), 0);
    assert.equal(minesPresentationDelay(duration, false), duration);
  }
});

test("risk labels are concise PT-BR labels for all selectable mine counts", () => {
  assert.deepEqual([1, 3, 5, 10].map(minesRiskLevel), ["low", "medium", "high", "extreme"]);
  assert.deepEqual([1, 3, 5, 10].map(minesRiskLabel), ["BAIXO", "MÉDIO", "ALTO", "EXTREMO"]);
});
