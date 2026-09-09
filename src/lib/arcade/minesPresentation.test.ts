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

test("safe reveal pacing stays inside the responsive 160-220 ms budget", () => {
  assert.equal(MINES_SAFE_REVEAL_BUDGET, 180);
  assert.ok(MINES_SAFE_REVEAL_BUDGET >= 160);
  assert.ok(MINES_SAFE_REVEAL_BUDGET <= 220);
});

test("mine reveal preserves danger and explosion phases without dragging input pacing", () => {
  assert.equal(MINES_MINE_REVEAL_BUDGET, 377);
  assert.ok(MINES_PRESENTATION_TIMING.danger > 0);
  assert.ok(MINES_PRESENTATION_TIMING.explosion > 0);
  assert.ok(MINES_MINE_REVEAL_BUDGET >= 340);
  assert.ok(MINES_MINE_REVEAL_BUDGET <= 450);
});

test("cashout pacing stays inside the tuned reward window", () => {
  assert.equal(MINES_CASHOUT_BUDGET, 440);
  assert.ok(MINES_CASHOUT_BUDGET >= 400);
  assert.ok(MINES_CASHOUT_BUDGET <= 550);
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
