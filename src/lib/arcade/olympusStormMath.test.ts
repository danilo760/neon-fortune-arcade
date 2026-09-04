import assert from "node:assert/strict";
import test from "node:test";

import {
  OLYMPUS_COLUMNS,
  OLYMPUS_ROWS,
  OLYMPUS_SIZE,
  collapseOlympusGrid,
  findOlympusClusters,
  makeOlympusGrid,
  planOlympusRound,
} from "./olympusStormMath";

test("Olympus uses a real 6x5 grid", () => {
  assert.equal(OLYMPUS_COLUMNS, 6);
  assert.equal(OLYMPUS_ROWS, 5);
  assert.equal(OLYMPUS_SIZE, 30);
  assert.equal(makeOlympusGrid(() => 0.5).length, 30);
});

test("Olympus cluster detection uses orthogonal adjacency and minimum five", () => {
  const grid = Array.from({ length: 30 }, () => "coin" as const);
  grid[0] = "bolt";
  grid[1] = "bolt";
  grid[2] = "bolt";
  grid[6] = "bolt";
  grid[7] = "bolt";
  grid[14] = "bolt";

  const clusters = findOlympusClusters(grid, 100);
  const bolt = clusters.find((cluster) => cluster.symbol === "bolt");
  assert.ok(bolt);
  assert.deepEqual(bolt.indexes, [0, 1, 2, 6, 7]);
});

test("collapse removes winners, drops survivors and refills from the top", () => {
  const grid = Array.from({ length: 30 }, (_, index) =>
    (index % 2 === 0 ? "coin" : "orb") as "coin" | "orb",
  );
  const removed = [0, 6, 12, 18, 24];
  const next = collapseOlympusGrid(grid, removed, () => 0.99);
  assert.equal(next.length, 30);
  assert.ok(next.every(Boolean));
});

test("round planning is deterministic when an rng is supplied", () => {
  let stateA = 123456789;
  let stateB = 123456789;
  const rngA = () => {
    stateA = (stateA * 1664525 + 1013904223) >>> 0;
    return stateA / 4294967296;
  };
  const rngB = () => {
    stateB = (stateB * 1664525 + 1013904223) >>> 0;
    return stateB / 4294967296;
  };
  const a = planOlympusRound(100, rngA);
  const b = planOlympusRound(100, rngB);
  assert.deepEqual(a, b);
});

test("round payout equals the sum of cascade payouts", () => {
  let state = 987654321;
  const rng = () => {
    state = (state * 1103515245 + 12345) >>> 0;
    return state / 4294967296;
  };
  for (let index = 0; index < 250; index += 1) {
    const round = planOlympusRound(100, rng);
    const sum = round.cascades.reduce((total, cascade) => total + cascade.payout, 0);
    assert.equal(round.payout, sum);
    assert.ok(round.cascades.length <= 8);
  }
});
