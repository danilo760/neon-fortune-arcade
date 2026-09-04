import assert from "node:assert/strict";
import test from "node:test";

import {
  CANDY_COLUMNS,
  CANDY_ROWS,
  CANDY_SIZE,
  candyBombForCascade,
  collapseCandyGrid,
  findCandyClusters,
  makeCandyGrid,
  planCandyRound,
  type CandyCluster,
  type CandySymbolId,
} from "./candyCascadeMath";

test("Candy uses the requested 6x5 grid", () => {
  assert.equal(CANDY_COLUMNS, 6);
  assert.equal(CANDY_ROWS, 5);
  assert.equal(CANDY_SIZE, 30);
  assert.equal(makeCandyGrid(() => 0.5).length, 30);
});

test("Candy clusters require five orthogonally connected symbols", () => {
  const grid: CandySymbolId[] = Array.from({ length: 30 }, () => "candy");
  grid[0] = "diamond";
  grid[1] = "diamond";
  grid[2] = "diamond";
  grid[6] = "diamond";
  grid[7] = "diamond";
  grid[14] = "diamond";
  const cluster = findCandyClusters(grid, 100).find((entry) => entry.symbol === "diamond");
  assert.ok(cluster);
  assert.deepEqual(cluster.indexes, [0, 1, 2, 6, 7]);
});

test("large gameplay clusters can create a guaranteed Sugar Bomb", () => {
  const cluster: CandyCluster = {
    symbol: "candy",
    indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    payout: 100,
  };
  const bomb = candyBombForCascade([cluster], 0, () => 0);
  assert.ok(bomb);
  assert.equal(bomb.sourceClusterSize, 12);
  assert.ok(bomb.multiplier === 5 || bomb.multiplier === 10);
});

test("small first-cascade clusters do not create random bombs", () => {
  const cluster: CandyCluster = {
    symbol: "star",
    indexes: [0, 1, 2, 6, 7],
    payout: 100,
  };
  assert.equal(candyBombForCascade([cluster], 0, () => 0), null);
});

test("collapse refills every 6x5 cell", () => {
  const grid: CandySymbolId[] = Array.from({ length: 30 }, (_, index) =>
    index % 2 === 0 ? "star" : "jelly",
  );
  const next = collapseCandyGrid(grid, [0, 6, 12, 18, 24], () => 0.99);
  assert.equal(next.length, 30);
  assert.ok(next.every(Boolean));
});

test("Candy round planning remains deterministic with an injected rng", () => {
  let a = 123456;
  let b = 123456;
  const rngA = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  const rngB = () => ((b = (b * 1664525 + 1013904223) >>> 0) / 4294967296);
  assert.deepEqual(planCandyRound(100, rngA), planCandyRound(100, rngB));
});
