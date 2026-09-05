import assert from "node:assert/strict";
import test from "node:test";

import {
  CANDY_COLUMNS,
  CANDY_FEATURE_MAX_SPINS,
  CANDY_MAX_RETRIGGERS,
  CANDY_ROWS,
  CANDY_SCATTER_CHANCE,
  CANDY_SIZE,
  candyBombEnergy,
  candyBombForCascade,
  candyScatterAward,
  candySugarLevel,
  candySugarMultiplierForLevel,
  collapseCandyGrid,
  countCandyScatters,
  findCandyClusters,
  makeCandyGrid,
  planCandyFeature,
  planCandyRound,
  type CandyCluster,
  type CandySymbolId,
} from "./candyCascadeMath";

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
}

test("Candy uses the requested 6x5 grid", () => {
  assert.equal(CANDY_COLUMNS, 6);
  assert.equal(CANDY_ROWS, 5);
  assert.equal(CANDY_SIZE, 30);
  assert.equal(makeCandyGrid(() => 0.5).length, 30);
});

test("Party Candy is non-paying and regular clusters still require five orthogonal symbols", () => {
  const grid: CandySymbolId[] = Array.from({ length: 30 }, () => "partyCandy");
  grid[0] = "diamond";
  grid[1] = "diamond";
  grid[2] = "diamond";
  grid[6] = "diamond";
  grid[7] = "diamond";
  const cluster = findCandyClusters(grid, 100).find((entry) => entry.symbol === "diamond");
  assert.ok(cluster);
  assert.deepEqual(cluster.indexes, [0, 1, 2, 6, 7]);
  assert.equal(findCandyClusters(Array.from({ length: 30 }, () => "partyCandy"), 100).length, 0);
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
  assert.equal(bomb.energy, candyBombEnergy(bomb.multiplier));
});

test("small first-cascade base clusters do not create random bombs", () => {
  const cluster: CandyCluster = {
    symbol: "star",
    indexes: [0, 1, 2, 6, 7],
    payout: 100,
  };
  assert.equal(candyBombForCascade([cluster], 0, () => 0, "base"), null);
  assert.ok(candyBombForCascade([cluster], 0, () => 0, "freeSpins"));
});

test("collapse refills every 6x5 cell without creating cascade scatters", () => {
  const grid: CandySymbolId[] = Array.from({ length: 30 }, (_, index) =>
    index % 2 === 0 ? "star" : "jelly",
  );
  const next = collapseCandyGrid(grid, [0, 6, 12, 18, 24], () => 0);
  assert.equal(next.length, 30);
  assert.ok(next.every(Boolean));
  assert.equal(next.filter((symbol) => symbol === "partyCandy").length, 0);
});

test("scatter awards are explicit for base and free spins", () => {
  assert.equal(candyScatterAward(2, "base"), 0);
  assert.equal(candyScatterAward(3, "base"), 10);
  assert.equal(candyScatterAward(4, "base"), 14);
  assert.equal(candyScatterAward(5, "base"), 18);
  assert.equal(candyScatterAward(3, "freeSpins"), 5);
  assert.equal(candyScatterAward(4, "freeSpins"), 8);
  assert.equal(candyScatterAward(5, "freeSpins"), 10);
});

test("free-spin scatter table is calibrated separately and rarer than base", () => {
  assert.ok(CANDY_SCATTER_CHANCE.freeSpins < CANDY_SCATTER_CHANCE.base);
});

test("natural Sugar Party frequency stays in the explicit 1/100 to 1/60 band", () => {
  const rng = lcg(0x51a9cafe);
  const samples = 120_000;
  let triggers = 0;
  for (let index = 0; index < samples; index += 1) {
    if (countCandyScatters(makeCandyGrid(rng, "base")) >= 3) triggers += 1;
  }
  const oneIn = samples / triggers;
  assert.ok(oneIn >= 60 && oneIn <= 100, `expected 1/60..1/100, got 1/${oneIn}`);
});

test("Sugar Meter persists through feature spins and level multiplier is monotonic", () => {
  assert.equal(candySugarLevel(0), 1);
  assert.equal(candySugarLevel(1), 2);
  assert.equal(candySugarLevel(3), 3);
  assert.equal(candySugarLevel(6), 4);
  assert.equal(candySugarLevel(10), 5);
  assert.ok(candySugarMultiplierForLevel(5) > candySugarMultiplierForLevel(4));
  assert.ok(candySugarMultiplierForLevel(4) > candySugarMultiplierForLevel(1));
});

test("Candy round planning remains deterministic with an injected rng", () => {
  const rngA = lcg(123456);
  const rngB = lcg(123456);
  assert.deepEqual(planCandyRound(100, rngA), planCandyRound(100, rngB));
});

test("Candy feature planning is deterministic with a fixed RNG", () => {
  assert.deepEqual(planCandyFeature(100, 10, lcg(90210)), planCandyFeature(100, 10, lcg(90210)));
});

test("feature payout is non-negative and every planned grid remains 6x5", () => {
  const plan = planCandyFeature(100, 10, lcg(4411));
  assert.ok(plan.payout >= 0);
  for (const spin of plan.spins) {
    assert.equal(spin.round.initialGrid.length, 30);
    assert.equal(spin.round.finalGrid.length, 30);
    assert.ok(spin.round.payout >= 0);
  }
});

test("continuous retriggers respect MAX_RETRIGGERS", () => {
  const plan = planCandyFeature(100, 10, () => 0);
  assert.equal(plan.retriggers, CANDY_MAX_RETRIGGERS);
  assert.ok(plan.finalSpins <= CANDY_FEATURE_MAX_SPINS);
});

test("FEATURE_MAX_SPINS is enforced in the real feature loop", () => {
  const plan = planCandyFeature(100, CANDY_FEATURE_MAX_SPINS - 2, () => 0);
  assert.equal(plan.finalSpins, CANDY_FEATURE_MAX_SPINS);
  assert.ok(plan.spins.length <= CANDY_FEATURE_MAX_SPINS);
});
