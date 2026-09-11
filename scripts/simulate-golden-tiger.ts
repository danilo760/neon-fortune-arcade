import {
  FORTUNE_FEATURE_TRIGGER_CHANCE,
  rollFortuneFeatureTrigger,
  runFortuneFeature,
} from "../src/lib/arcade/goldenTigerFortuneFeature";
import {
  GOLDEN_TIGER_BONUS_BUY_MULTIPLIER,
  runPurchasedFortuneFeature,
} from "../src/lib/arcade/goldenTigerBonusBuy";
import {
  GOLDEN_TIGER_FULL_GRID_MULTIPLIER,
  GOLDEN_TIGER_PAYOUT_SCALE,
  evaluateGoldenTiger,
  makeGoldenTigerGrid,
} from "../src/lib/arcade/goldenTigerMath";
import { createSeededRng } from "../src/lib/arcade/rng";

const DEFAULT_SPINS = 150_000;
const DEFAULT_FEATURE_ENTRIES = 30_000;
const DEFAULT_SEEDS = [0x09681a11, 20_260_909, 20_260_910] as const;
const DEFAULT_BETS = [1, 20, 100] as const;

function positiveInteger(raw: string | undefined, fallback: number) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
}

function numberList(raw: string | undefined, fallback: readonly number[]) {
  if (!raw) return [...fallback];
  const values = raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  return values.length > 0 ? values : [...fallback];
}

function seedList(raw: string | undefined, fallback: readonly number[]) {
  if (!raw) return [...fallback];
  const values = raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 0xffffffff)
    .map((value) => value >>> 0);
  return values.length > 0 ? values : [...fallback];
}

const spins = positiveInteger(process.env.SPINS, DEFAULT_SPINS);
const featureEntries = positiveInteger(process.env.FEATURE_ENTRIES, DEFAULT_FEATURE_ENTRIES);
const seeds = seedList(process.env.SEEDS, DEFAULT_SEEDS);
const bets = numberList(process.env.BETS, DEFAULT_BETS);
const roundingReferenceBet = Math.max(...bets);

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function percent(value: number) {
  return `${(value * 100).toFixed(4)}%`;
}

function quantile(sortedValues: readonly number[], position: number) {
  if (sortedValues.length === 0) return 0;
  const clamped = Math.max(0, Math.min(1, position));
  const index = (sortedValues.length - 1) * clamped;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower] ?? 0;
  const lowerValue = sortedValues[lower] ?? 0;
  const upperValue = sortedValues[upper] ?? lowerValue;
  return lowerValue + (upperValue - lowerValue) * (index - lower);
}

function summarizeMultiples(values: number[]) {
  if (values.length === 0) {
    return { count: 0, mean: 0, p50: 0, p90: 0, p99: 0, max: 0 };
  }
  values.sort((left, right) => left - right);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    mean: round(total / values.length),
    p50: round(quantile(values, 0.5)),
    p90: round(quantile(values, 0.9)),
    p99: round(quantile(values, 0.99)),
    max: round(values[values.length - 1] ?? 0),
  };
}

type PaidSpinScenario = {
  seed: number;
  bet: number;
  spins: number;
  settledPayout: number;
  potentialBasePayout: number;
  baseHits: number;
  baseFullGrids: number;
  featureTriggers: number;
  featurePayout: number;
  featurePaying: number;
  featureFullGrids: number;
  featureRespins: number;
  featureMaxRespins: number;
  featureWinMultiples: number[];
};

function simulatePaidSpins(seed: number, bet: number): PaidSpinScenario {
  const rng = createSeededRng(seed);
  const scenario: PaidSpinScenario = {
    seed,
    bet,
    spins,
    settledPayout: 0,
    potentialBasePayout: 0,
    baseHits: 0,
    baseFullGrids: 0,
    featureTriggers: 0,
    featurePayout: 0,
    featurePaying: 0,
    featureFullGrids: 0,
    featureRespins: 0,
    featureMaxRespins: 0,
    featureWinMultiples: [],
  };

  for (let spin = 0; spin < spins; spin += 1) {
    const grid = makeGoldenTigerGrid(rng);
    const base = evaluateGoldenTiger(grid, bet);
    scenario.potentialBasePayout += base.payout;
    if (base.payout > 0) scenario.baseHits += 1;
    if (base.isFullGrid) scenario.baseFullGrids += 1;

    if (!rollFortuneFeatureTrigger(rng)) {
      scenario.settledPayout += base.payout;
      continue;
    }

    scenario.featureTriggers += 1;
    const feature = runFortuneFeature(bet, rng);
    scenario.featurePayout += feature.payout;
    scenario.settledPayout += feature.payout;
    scenario.featureRespins += feature.respinsUsed;
    scenario.featureMaxRespins = Math.max(scenario.featureMaxRespins, feature.respinsUsed);
    scenario.featureWinMultiples.push(feature.payout / bet);
    if (feature.payout > 0) scenario.featurePaying += 1;
    if (feature.isFullGrid) scenario.featureFullGrids += 1;
  }

  return scenario;
}

type PurchasedScenario = {
  seed: number;
  bet: number;
  entries: number;
  payout: number;
  paying: number;
  fullGrids: number;
  respins: number;
  maxRespins: number;
  winMultiples: number[];
  buckets: {
    zero: number;
    belowCost: number;
    costTo2x: number;
    twoTo5x: number;
    fiveXPlus: number;
  };
};

function simulatePurchasedFeatures(seed: number, bet: number): PurchasedScenario {
  const rng = createSeededRng(seed ^ 0x9e3779b9);
  const scenario: PurchasedScenario = {
    seed,
    bet,
    entries: featureEntries,
    payout: 0,
    paying: 0,
    fullGrids: 0,
    respins: 0,
    maxRespins: 0,
    winMultiples: [],
    buckets: {
      zero: 0,
      belowCost: 0,
      costTo2x: 0,
      twoTo5x: 0,
      fiveXPlus: 0,
    },
  };

  for (let entry = 0; entry < featureEntries; entry += 1) {
    const feature = runPurchasedFortuneFeature(bet, rng);
    const multiple = feature.payout / bet;
    scenario.payout += feature.payout;
    scenario.respins += feature.respinsUsed;
    scenario.maxRespins = Math.max(scenario.maxRespins, feature.respinsUsed);
    scenario.winMultiples.push(multiple);
    if (feature.payout > 0) scenario.paying += 1;
    if (feature.isFullGrid) scenario.fullGrids += 1;

    if (feature.payout <= 0) scenario.buckets.zero += 1;
    else if (multiple < GOLDEN_TIGER_BONUS_BUY_MULTIPLIER) scenario.buckets.belowCost += 1;
    else if (multiple < GOLDEN_TIGER_BONUS_BUY_MULTIPLIER * 2) scenario.buckets.costTo2x += 1;
    else if (multiple < GOLDEN_TIGER_BONUS_BUY_MULTIPLIER * 5) scenario.buckets.twoTo5x += 1;
    else scenario.buckets.fiveXPlus += 1;
  }

  return scenario;
}

const paidScenarios = seeds.flatMap((seed) => bets.map((bet) => simulatePaidSpins(seed, bet)));
const purchasedScenarios = seeds.flatMap((seed) => bets.map((bet) => simulatePurchasedFeatures(seed, bet)));

function aggregatePaidForBet(bet: number) {
  const scenarios = paidScenarios.filter((scenario) => scenario.bet === bet);
  const totalSpins = scenarios.reduce((sum, scenario) => sum + scenario.spins, 0);
  const settledPayout = scenarios.reduce((sum, scenario) => sum + scenario.settledPayout, 0);
  const potentialBasePayout = scenarios.reduce((sum, scenario) => sum + scenario.potentialBasePayout, 0);
  const baseHits = scenarios.reduce((sum, scenario) => sum + scenario.baseHits, 0);
  const baseFullGrids = scenarios.reduce((sum, scenario) => sum + scenario.baseFullGrids, 0);
  const featureTriggers = scenarios.reduce((sum, scenario) => sum + scenario.featureTriggers, 0);
  const featurePayout = scenarios.reduce((sum, scenario) => sum + scenario.featurePayout, 0);
  const featurePaying = scenarios.reduce((sum, scenario) => sum + scenario.featurePaying, 0);
  const featureFullGrids = scenarios.reduce((sum, scenario) => sum + scenario.featureFullGrids, 0);
  const featureRespins = scenarios.reduce((sum, scenario) => sum + scenario.featureRespins, 0);
  const featureMaxRespins = Math.max(...scenarios.map((scenario) => scenario.featureMaxRespins), 0);
  const featureMultiples = scenarios.flatMap((scenario) => scenario.featureWinMultiples);

  return {
    bet,
    samples: totalSpins,
    combinedRtp: round(ratio(settledPayout, totalSpins * bet)),
    combinedRtpPercent: percent(ratio(settledPayout, totalSpins * bet)),
    potentialBaseOnlyRtp: round(ratio(potentialBasePayout, totalSpins * bet)),
    baseHitFrequency: percent(ratio(baseHits, totalSpins)),
    baseFullGridFrequency: percent(ratio(baseFullGrids, totalSpins)),
    naturalFeature: {
      configuredTriggerChance: percent(FORTUNE_FEATURE_TRIGGER_CHANCE),
      observedTriggerFrequency: percent(ratio(featureTriggers, totalSpins)),
      triggerCount: featureTriggers,
      payoutContributionToPaidSpinRtp: round(ratio(featurePayout, totalSpins * bet)),
      payingRate: percent(ratio(featurePaying, featureTriggers)),
      fullGridRate: percent(ratio(featureFullGrids, featureTriggers)),
      averageRespins: round(ratio(featureRespins, featureTriggers)),
      maxRespinsObserved: featureMaxRespins,
      winMultipleDistribution: summarizeMultiples(featureMultiples),
    },
  };
}

function aggregatePurchasedForBet(bet: number) {
  const scenarios = purchasedScenarios.filter((scenario) => scenario.bet === bet);
  const totalEntries = scenarios.reduce((sum, scenario) => sum + scenario.entries, 0);
  const payout = scenarios.reduce((sum, scenario) => sum + scenario.payout, 0);
  const paying = scenarios.reduce((sum, scenario) => sum + scenario.paying, 0);
  const fullGrids = scenarios.reduce((sum, scenario) => sum + scenario.fullGrids, 0);
  const respins = scenarios.reduce((sum, scenario) => sum + scenario.respins, 0);
  const maxRespins = Math.max(...scenarios.map((scenario) => scenario.maxRespins), 0);
  const winMultiples = scenarios.flatMap((scenario) => scenario.winMultiples);
  const buckets = scenarios.reduce(
    (accumulator, scenario) => ({
      zero: accumulator.zero + scenario.buckets.zero,
      belowCost: accumulator.belowCost + scenario.buckets.belowCost,
      costTo2x: accumulator.costTo2x + scenario.buckets.costTo2x,
      twoTo5x: accumulator.twoTo5x + scenario.buckets.twoTo5x,
      fiveXPlus: accumulator.fiveXPlus + scenario.buckets.fiveXPlus,
    }),
    { zero: 0, belowCost: 0, costTo2x: 0, twoTo5x: 0, fiveXPlus: 0 },
  );

  return {
    bet,
    samples: totalEntries,
    costMultiple: GOLDEN_TIGER_BONUS_BUY_MULTIPLIER,
    returnRatio: round(ratio(payout, totalEntries * bet * GOLDEN_TIGER_BONUS_BUY_MULTIPLIER)),
    returnPercent: percent(ratio(payout, totalEntries * bet * GOLDEN_TIGER_BONUS_BUY_MULTIPLIER)),
    payingRate: percent(ratio(paying, totalEntries)),
    fullGridRate: percent(ratio(fullGrids, totalEntries)),
    averageRespins: round(ratio(respins, totalEntries)),
    maxRespinsObserved: maxRespins,
    winMultipleDistribution: summarizeMultiples(winMultiples),
    hitDistribution: {
      zero: percent(ratio(buckets.zero, totalEntries)),
      belowCost: percent(ratio(buckets.belowCost, totalEntries)),
      costTo2x: percent(ratio(buckets.costTo2x, totalEntries)),
      twoTo5x: percent(ratio(buckets.twoTo5x, totalEntries)),
      fiveXPlus: percent(ratio(buckets.fiveXPlus, totalEntries)),
    },
  };
}

const paidByBet = bets.map(aggregatePaidForBet);
const purchasedByBet = bets.map(aggregatePurchasedForBet);
const paidReference = paidByBet.find((entry) => entry.bet === roundingReferenceBet);
const purchasedReference = purchasedByBet.find((entry) => entry.bet === roundingReferenceBet);

const report = {
  model: "Neon Golden Tiger — current Fortune Feature model",
  generatedAt: new Date().toISOString(),
  reproducibility: {
    spinsPerSeedAndBet: spins,
    purchasedFeaturesPerSeedAndBet: featureEntries,
    seeds,
    bets,
    note: "Re-run with the same SPINS, FEATURE_ENTRIES, SEEDS and BETS environment values to reproduce the same RNG streams.",
  },
  calibration: {
    payoutScale: GOLDEN_TIGER_PAYOUT_SCALE,
    fullGridMultiplier: GOLDEN_TIGER_FULL_GRID_MULTIPLIER,
    naturalFeatureTriggerChance: FORTUNE_FEATURE_TRIGGER_CHANCE,
    purchasedFeatureCostMultiple: GOLDEN_TIGER_BONUS_BUY_MULTIPLIER,
  },
  paidGame: paidByBet.map((entry) => ({
    ...entry,
    roundingDeltaVsReferenceBet: paidReference
      ? round(entry.combinedRtp - paidReference.combinedRtp)
      : 0,
  })),
  purchasedFeature: purchasedByBet.map((entry) => ({
    ...entry,
    roundingDeltaVsReferenceBet: purchasedReference
      ? round(entry.returnRatio - purchasedReference.returnRatio)
      : 0,
  })),
  rounding: {
    referenceBet: roundingReferenceBet,
    explanation: "All bets reuse identical seeded RNG streams. Differences in normalized return by bet therefore expose payout-rounding effects rather than different random outcomes.",
  },
  perSeed: {
    paidGame: paidScenarios.map((scenario) => ({
      seed: scenario.seed,
      bet: scenario.bet,
      combinedRtp: round(ratio(scenario.settledPayout, scenario.spins * scenario.bet)),
      triggerFrequency: percent(ratio(scenario.featureTriggers, scenario.spins)),
      baseFullGridFrequency: percent(ratio(scenario.baseFullGrids, scenario.spins)),
      featureFullGridRate: percent(ratio(scenario.featureFullGrids, scenario.featureTriggers)),
    })),
    purchasedFeature: purchasedScenarios.map((scenario) => ({
      seed: scenario.seed,
      bet: scenario.bet,
      returnRatio: round(
        ratio(
          scenario.payout,
          scenario.entries * scenario.bet * GOLDEN_TIGER_BONUS_BUY_MULTIPLIER,
        ),
      ),
      payingRate: percent(ratio(scenario.paying, scenario.entries)),
      fullGridRate: percent(ratio(scenario.fullGrids, scenario.entries)),
    })),
  },
};

console.log(JSON.stringify(report, null, 2));
