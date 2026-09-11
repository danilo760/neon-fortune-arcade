import { describe, expect, it } from "vitest";

import {
  resolveGoldenTigerBasePaylines,
  resolveGoldenTigerFeaturePaylines,
} from "./goldenTigerPaylinePresentation";

const BET = 20;

describe("goldenTigerPaylinePresentation", () => {
  it("resolves only the actual base paylines instead of inferring them from the winning-cell union", () => {
    const grid = [
      "lion", "lion", "lion",
      "jade", "orange", "ingot",
      "firecracker", "lantern", "jade",
    ] as const;

    const lines = resolveGoldenTigerBasePaylines(grid, BET);

    expect(lines.map((line) => line.index)).toEqual([0]);
    expect(lines[0]?.cells).toEqual([0, 1, 2]);
    expect(lines[0]?.payout).toBeGreaterThan(0);
  });

  it("keeps full-grid multiplier out of each line presentation", () => {
    const grid = Array.from({ length: 9 }, () => "lion") as Array<"lion">;

    const lines = resolveGoldenTigerBasePaylines(grid, BET);

    expect(lines).toHaveLength(5);
    expect(new Set(lines.map((line) => line.payout)).size).toBe(1);
  });

  it("resolves feature paylines through the existing feature evaluator", () => {
    const grid = [
      "jade", "wild", "jade",
      null, null, null,
      null, null, null,
    ] as const;

    const lines = resolveGoldenTigerFeaturePaylines(grid, "jade", BET);

    expect(lines.map((line) => line.index)).toEqual([0]);
    expect(lines[0]?.points).toBe("0.5,0.5 1.5,0.5 2.5,0.5");
  });
});
