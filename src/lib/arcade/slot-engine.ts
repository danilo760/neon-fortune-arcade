import { chance, pickWeighted, randomInt, type Rng, type Weighted } from "./rng";

/** ---------- Types ---------- */

export interface SlotSymbol {
  id: string;
  label: string;
  glyph: string;
  weight: number;
  /** Line games: payout multiplier per matching count. Cluster games: tiers. */
  linePays?: Record<number, number>;
  clusterTiers?: { min: number; multiplier: number }[];
  kind?: "normal" | "wild" | "bonus" | "multiplier";
}

export interface SlotConfig {
  slug: string;
  name: string;
  cols: number;
  rows: number;
  mode: "lines" | "cluster";
  symbols: SlotSymbol[];
  /** Lines mode: each line is a list of [row, col] cells. */
  lines?: [number, number][][];
  wildId?: string;
  bonusId?: string;
  bonusTriggerCount?: number;
  freeSpinsAwarded?: number;
  minCluster?: number;
  /** Probability a cascade step spawns a bonus multiplier orb. */
  multiplierChance?: number;
  multiplierValues?: number[];
  /** Probability a line win receives an extra multiplier. */
  winMultiplierChance?: number;
  winMultiplierValues?: number[];
  paytableNote: string;
}

export type Grid = string[][]; // grid[row][col]

export interface LineWin {
  lineIndex: number;
  symbolId: string;
  count: number;
  cells: [number, number][];
  payout: number;
  multiplier: number;
}

export interface LinesSpinResult {
  kind: "lines";
  grid: Grid;
  wins: LineWin[];
  payout: number;
  totalMultiplier: number;
  freeSpinsAwarded: number;
  bonusCells: [number, number][];
}

export interface ClusterWin {
  symbolId: string;
  cells: [number, number][];
  payout: number;
}

export interface CascadeStep {
  grid: Grid;
  wins: ClusterWin[];
  /** cell -> multiplier orbs revealed on this step */
  multipliers: { cell: [number, number]; value: number }[];
  stepPayout: number;
}

export interface ClusterSpinResult {
  kind: "cluster";
  steps: CascadeStep[];
  finalGrid: Grid;
  basePayout: number;
  totalMultiplier: number;
  payout: number;
}

export type SpinResult = LinesSpinResult | ClusterSpinResult;

/** ---------- Helpers ---------- */

function symbolWeights(config: SlotConfig): Weighted<string>[] {
  return config.symbols
    .filter((symbol) => symbol.kind !== "multiplier")
    .map((symbol) => ({ value: symbol.id, weight: symbol.weight }));
}

export function symbolById(config: SlotConfig, id: string): SlotSymbol {
  const found = config.symbols.find((symbol) => symbol.id === id);
  if (!found) throw new Error(`Unknown symbol "${id}" in ${config.slug}`);
  return found;
}

export function randomGrid(config: SlotConfig, rng: Rng): Grid {
  const weights = symbolWeights(config);
  return Array.from({ length: config.rows }, () =>
    Array.from({ length: config.cols }, () => pickWeighted(rng, weights)),
  );
}

/** ---------- Lines mode ---------- */

export function evaluateLines(
  config: SlotConfig,
  grid: Grid,
  bet: number,
  rng: Rng,
): LinesSpinResult {
  const lines = config.lines ?? [];
  const wins: LineWin[] = [];

  for (const [lineIndex, line] of lines.entries()) {
    const ids = line.map(([row, col]) => grid[row]?.[col] ?? "");
    const base = ids.find((id) => id !== config.wildId);
    if (!base) continue;
    let count = 0;
    for (const id of ids) {
      if (id === base || id === config.wildId) count++;
      else break;
    }
    const symbol = symbolById(config, base);
    const pay = symbol.linePays?.[count];
    if (!pay) continue;

    let multiplier = 1;
    if (config.winMultiplierValues?.length && chance(rng, config.winMultiplierChance ?? 0)) {
      multiplier =
        config.winMultiplierValues[randomInt(rng, 0, config.winMultiplierValues.length - 1)]!;
    }

    wins.push({
      lineIndex,
      symbolId: base,
      count,
      cells: line.slice(0, count),
      payout: bet * pay * multiplier,
      multiplier,
    });
  }

  const bonusCells: [number, number][] = [];
  if (config.bonusId) {
    for (let row = 0; row < config.rows; row++) {
      for (let col = 0; col < config.cols; col++) {
        if (grid[row]?.[col] === config.bonusId) bonusCells.push([row, col]);
      }
    }
  }
  const triggered = bonusCells.length >= (config.bonusTriggerCount ?? 99);

  const payout = Math.round(wins.reduce((sum, win) => sum + win.payout, 0));
  const totalMultiplier = bet > 0 ? payout / bet : 0;

  return {
    kind: "lines",
    grid,
    wins,
    payout,
    totalMultiplier,
    freeSpinsAwarded: triggered ? (config.freeSpinsAwarded ?? 0) : 0,
    bonusCells,
  };
}

/** ---------- Cluster mode ---------- */

function findClusters(config: SlotConfig, grid: Grid): ClusterWin[] {
  const min = config.minCluster ?? 5;
  const seen = new Set<string>();
  const clusters: ClusterWin[] = [];

  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      const key = `${row}:${col}`;
      if (seen.has(key)) continue;
      const id = grid[row]?.[col];
      if (!id) continue;
      const stack: [number, number][] = [[row, col]];
      const group: [number, number][] = [];
      seen.add(key);
      while (stack.length) {
        const [r, c] = stack.pop()!;
        group.push([r, c]);
        const neighbours: [number, number][] = [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1],
        ];
        for (const [nr, nc] of neighbours) {
          if (nr < 0 || nc < 0 || nr >= config.rows || nc >= config.cols) continue;
          const nKey = `${nr}:${nc}`;
          if (seen.has(nKey)) continue;
          if (grid[nr]?.[nc] !== id) continue;
          seen.add(nKey);
          stack.push([nr, nc]);
        }
      }
      if (group.length >= min) {
        clusters.push({ symbolId: id, cells: group, payout: 0 });
      }
    }
  }
  return clusters;
}

function clusterPay(symbol: SlotSymbol, count: number): number {
  const tiers = symbol.clusterTiers ?? [];
  let multiplier = 0;
  for (const tier of tiers) {
    if (count >= tier.min) multiplier = tier.multiplier;
  }
  return multiplier;
}

function collapse(config: SlotConfig, grid: Grid, removed: Set<string>, rng: Rng): Grid {
  const weights = symbolWeights(config);
  const next: Grid = Array.from({ length: config.rows }, () =>
    Array.from({ length: config.cols }, () => ""),
  );

  for (let col = 0; col < config.cols; col++) {
    const survivors: string[] = [];
    for (let row = config.rows - 1; row >= 0; row--) {
      if (!removed.has(`${row}:${col}`)) survivors.push(grid[row]![col]!);
    }
    for (let row = config.rows - 1; row >= 0; row--) {
      const index = config.rows - 1 - row;
      next[row]![col] = survivors[index] ?? pickWeighted(rng, weights);
    }
  }
  return next;
}

export function spinCluster(config: SlotConfig, bet: number, rng: Rng): ClusterSpinResult {
  let grid = randomGrid(config, rng);
  const steps: CascadeStep[] = [];
  let basePayout = 0;
  let multiplierTotal = 0;
  let guard = 0;

  while (guard++ < 12) {
    const clusters = findClusters(config, grid);
    if (clusters.length === 0) {
      steps.push({ grid, wins: [], multipliers: [], stepPayout: 0 });
      break;
    }
    const wins = clusters.map((cluster) => ({
      ...cluster,
      payout: Math.round(
        bet * clusterPay(symbolById(config, cluster.symbolId), cluster.cells.length),
      ),
    }));
    const stepPayout = wins.reduce((sum, win) => sum + win.payout, 0);
    basePayout += stepPayout;

    const multipliers: { cell: [number, number]; value: number }[] = [];
    if (config.multiplierValues?.length && chance(rng, config.multiplierChance ?? 0)) {
      const value = config.multiplierValues[randomInt(rng, 0, config.multiplierValues.length - 1)]!;
      multipliers.push({
        cell: [randomInt(rng, 0, config.rows - 1), randomInt(rng, 0, config.cols - 1)],
        value,
      });
      multiplierTotal += value;
    }

    steps.push({ grid, wins, multipliers, stepPayout });

    const removed = new Set<string>();
    for (const win of wins) for (const [r, c] of win.cells) removed.add(`${r}:${c}`);
    grid = collapse(config, grid, removed, rng);
  }

  const totalMultiplier = Math.max(1, multiplierTotal);
  const payout = Math.round(basePayout * totalMultiplier);

  return {
    kind: "cluster",
    steps,
    finalGrid: grid,
    basePayout,
    totalMultiplier,
    payout,
  };
}

export function spinLines(config: SlotConfig, bet: number, rng: Rng): LinesSpinResult {
  return evaluateLines(config, randomGrid(config, rng), bet, rng);
}

export function spin(config: SlotConfig, bet: number, rng: Rng): SpinResult {
  return config.mode === "cluster" ? spinCluster(config, bet, rng) : spinLines(config, bet, rng);
}
