import {
  GOLDEN_TIGER_FEATURE_BUY_COST_MULTIPLIER,
  GOLDEN_TIGER_FEATURE_BUY_INITIAL_SPINS,
  GOLDEN_TIGER_MAX_RETRIGGERS,
  evaluateGoldenTiger,
  makeGoldenTigerGrid,
} from "../src/lib/arcade/goldenTigerMath";

const requested = Number(process.env.SPINS ?? 1_000_000);
const baseSpins = Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : 1_000_000;
const requestedFeatures = Number(process.env.FEATURE_ENTRIES ?? 1_000_000);
const featureEntries = Number.isFinite(requestedFeatures) && requestedFeatures >= 1
  ? Math.floor(requestedFeatures)
  : 1_000_000;

let state = 0x7f4a7c15;
function rng() {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4_294_967_296;
}

let scatter3 = 0;
let scatter4 = 0;
let scatter5Plus = 0;
let basePayout = 0;
let baseHits = 0;
let bonusPayout = 0;
let bonusCount = 0;
let bonusSpinTotal = 0;
let bonusWithRetrigger = 0;
let retriggerTotal = 0;
let maxBonusSpins = 0;

function simulateBonus(initialSpins: number) {
  let spinsLeft = initialSpins;
  let totalSpins = 0;
  let retriggers = 0;
  let payout = 0;

  while (spinsLeft > 0) {
    spinsLeft -= 1;
    totalSpins += 1;
    const grid = makeGoldenTigerGrid("freeSpins", rng);
    const result = evaluateGoldenTiger(grid, 1, "freeSpins");
    payout += result.payout;

    if (result.bonusAward > 0 && retriggers < GOLDEN_TIGER_MAX_RETRIGGERS) {
      spinsLeft += result.bonusAward;
      retriggers += 1;
    }
  }

  return { payout, retriggers, totalSpins };
}

for (let index = 0; index < baseSpins; index += 1) {
  const grid = makeGoldenTigerGrid("base", rng);
  const result = evaluateGoldenTiger(grid, 1, "base");
  basePayout += result.payout;
  if (result.payout > 0) baseHits += 1;

  if (result.scatterCount === 3) scatter3 += 1;
  else if (result.scatterCount === 4) scatter4 += 1;
  else if (result.scatterCount >= 5) scatter5Plus += 1;

  if (result.bonusAward <= 0) continue;
  bonusCount += 1;
  const bonus = simulateBonus(result.bonusAward);
  bonusPayout += bonus.payout;
  bonusSpinTotal += bonus.totalSpins;
  retriggerTotal += bonus.retriggers;
  if (bonus.retriggers > 0) bonusWithRetrigger += 1;
  maxBonusSpins = Math.max(maxBonusSpins, bonus.totalSpins);
}

const featureOutcomes = new Float64Array(featureEntries);
let featurePayoutTotal = 0;
let featureSquareTotal = 0;
let featureSpinTotal = 0;
let featureRetriggerTotal = 0;
let featureWithRetrigger = 0;
let featureMax = 0;
let featureMaxSpins = 0;
const featureDistribution = {
  zero: 0,
  belowCost: 0,
  costTo2x: 0,
  twoTo5x: 0,
  fiveXPlus: 0,
};

for (let index = 0; index < featureEntries; index += 1) {
  const feature = simulateBonus(GOLDEN_TIGER_FEATURE_BUY_INITIAL_SPINS);
  featureOutcomes[index] = feature.payout;
  featurePayoutTotal += feature.payout;
  featureSquareTotal += feature.payout * feature.payout;
  featureSpinTotal += feature.totalSpins;
  featureRetriggerTotal += feature.retriggers;
  if (feature.retriggers > 0) featureWithRetrigger += 1;
  featureMax = Math.max(featureMax, feature.payout);
  featureMaxSpins = Math.max(featureMaxSpins, feature.totalSpins);

  if (feature.payout <= 0) featureDistribution.zero += 1;
  else if (feature.payout < GOLDEN_TIGER_FEATURE_BUY_COST_MULTIPLIER) featureDistribution.belowCost += 1;
  else if (feature.payout < GOLDEN_TIGER_FEATURE_BUY_COST_MULTIPLIER * 2) featureDistribution.costTo2x += 1;
  else if (feature.payout < GOLDEN_TIGER_FEATURE_BUY_COST_MULTIPLIER * 5) featureDistribution.twoTo5x += 1;
  else featureDistribution.fiveXPlus += 1;
}

featureOutcomes.sort();
const mid = Math.floor(featureEntries / 2);
const featureMedian = featureEntries % 2 === 0
  ? ((featureOutcomes[mid - 1] ?? 0) + (featureOutcomes[mid] ?? 0)) / 2
  : (featureOutcomes[mid] ?? 0);
const featureMean = featurePayoutTotal / featureEntries;
const featureVariance = Math.max(0, featureSquareTotal / featureEntries - featureMean ** 2);
const featureStdDev = Math.sqrt(featureVariance);
const featureRtp = featureMean / GOLDEN_TIGER_FEATURE_BUY_COST_MULTIPLIER;

const triggerCount = scatter3 + scatter4 + scatter5Plus;
const percent = (value: number) => `${(value * 100).toFixed(4)}%`;
const round = (value: number) => Number(value.toFixed(6));

const report = {
  baseSpins,
  scatters: {
    three: { count: scatter3, frequency: percent(scatter3 / baseSpins) },
    four: { count: scatter4, frequency: percent(scatter4 / baseSpins) },
    fivePlus: { count: scatter5Plus, frequency: percent(scatter5Plus / baseSpins) },
    totalTrigger: {
      count: triggerCount,
      frequency: percent(triggerCount / baseSpins),
      oneIn: triggerCount > 0 ? round(baseSpins / triggerCount) : null,
    },
  },
  bonus: {
    count: bonusCount,
    averageFinalSpins: bonusCount > 0 ? round(bonusSpinTotal / bonusCount) : 0,
    bonusesWithRetrigger: bonusCount > 0 ? percent(bonusWithRetrigger / bonusCount) : "0%",
    averageRetriggers: bonusCount > 0 ? round(retriggerTotal / bonusCount) : 0,
    maxRetriggersAllowed: GOLDEN_TIGER_MAX_RETRIGGERS,
    maxFinalSpinsFound: maxBonusSpins,
  },
  payoutRelativeToBet: {
    baseGame: round(basePayout / baseSpins),
    freeSpinContribution: round(bonusPayout / baseSpins),
    combined: round((basePayout + bonusPayout) / baseSpins),
    baseHitFrequency: percent(baseHits / baseSpins),
  },
  featureBuy: {
    name: "Golden Fortune",
    entries: featureEntries,
    initialSpins: GOLDEN_TIGER_FEATURE_BUY_INITIAL_SPINS,
    costMultiple: GOLDEN_TIGER_FEATURE_BUY_COST_MULTIPLIER,
    featureRtp: percent(featureRtp),
    averageWinMultiple: round(featureMean),
    medianWinMultiple: round(featureMedian),
    standardDeviation: round(featureStdDev),
    maxObservedWinMultiple: round(featureMax),
    averageFinalSpins: round(featureSpinTotal / featureEntries),
    retriggerFrequency: percent(featureWithRetrigger / featureEntries),
    averageRetriggers: round(featureRetriggerTotal / featureEntries),
    maxFinalSpinsFound: featureMaxSpins,
    hitDistribution: {
      zero: percent(featureDistribution.zero / featureEntries),
      belowCost: percent(featureDistribution.belowCost / featureEntries),
      costTo2x: percent(featureDistribution.costTo2x / featureEntries),
      twoTo5x: percent(featureDistribution.twoTo5x / featureEntries),
      fiveXPlus: percent(featureDistribution.fiveXPlus / featureEntries),
    },
  },
};

console.log(JSON.stringify(report, null, 2));
