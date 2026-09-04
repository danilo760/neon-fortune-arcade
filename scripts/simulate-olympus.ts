import {
  OLYMPUS_FEATURE_BUY_COST_MULTIPLIER,
  olympusFeatureBuyCost,
  planOlympusFeature,
  planOlympusRound,
} from "../src/lib/arcade/olympusStormMath";

const baseRequested = Number(process.env.BASE_SPINS ?? process.env.SPINS ?? 1_000_000);
const featureRequested = Number(process.env.FEATURE_BUYS ?? 1_000_000);
const baseSpins = Number.isFinite(baseRequested) && baseRequested >= 1 ? Math.floor(baseRequested) : 1_000_000;
const featureBuys = Number.isFinite(featureRequested) && featureRequested >= 1 ? Math.floor(featureRequested) : 1_000_000;
const bet = 100;

let state = 0x43f6a888;
function rng() {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4_294_967_296;
}

const percent = (value: number) => `${(value * 100).toFixed(4)}%`;
const round = (value: number) => Number(value.toFixed(6));
const ordered = (map: Map<number, number>) =>
  Object.fromEntries([...map.entries()].sort(([a], [b]) => a - b));

let baseCascadePayout = 0;
let baseBonusPayout = 0;
let baseCascades = 0;
let baseStormHits = 0;
let baseHitSpins = 0;
let maxCascades = 0;
let scatter3 = 0;
let scatter4 = 0;
let scatter5Plus = 0;
const cascadeDistribution = new Map<number, number>();
const multiplierDistribution = new Map<number, number>();
const naturalDuration = new Map<number, { count: number; spins: number }>();

for (let index = 0; index < baseSpins; index += 1) {
  const planned = planOlympusRound(bet, rng);
  baseCascadePayout += planned.payout;
  baseCascades += planned.cascades.length;
  baseStormHits += planned.stormHits;
  if (planned.payout > 0) baseHitSpins += 1;
  maxCascades = Math.max(maxCascades, planned.cascades.length);
  cascadeDistribution.set(planned.cascades.length, (cascadeDistribution.get(planned.cascades.length) ?? 0) + 1);
  for (const cascade of planned.cascades) {
    multiplierDistribution.set(cascade.multiplier, (multiplierDistribution.get(cascade.multiplier) ?? 0) + 1);
  }

  if (planned.scatterCount === 3) scatter3 += 1;
  else if (planned.scatterCount === 4) scatter4 += 1;
  else if (planned.scatterCount >= 5) scatter5Plus += 1;

  if (planned.freeSpinsAward > 0) {
    const feature = planOlympusFeature(bet, planned.freeSpinsAward, rng);
    baseBonusPayout += feature.payout;
    const current = naturalDuration.get(planned.freeSpinsAward) ?? { count: 0, spins: 0 };
    current.count += 1;
    current.spins += feature.finalSpins;
    naturalDuration.set(planned.freeSpinsAward, current);
  }
}

const totalNaturalTriggers = scatter3 + scatter4 + scatter5Plus;
const baseReport = {
  spins: baseSpins,
  bet,
  grid: "6x5",
  clusterMinimum: 5,
  hitFrequency: percent(baseHitSpins / baseSpins),
  averageCascades: round(baseCascades / baseSpins),
  maxCascades,
  stormHitsPerSpin: round(baseStormHits / baseSpins),
  scatter3,
  scatter4,
  scatter5Plus,
  bonusFrequency: percent(totalNaturalTriggers / baseSpins),
  averageSpinsBetweenBonus: totalNaturalTriggers > 0 ? round(baseSpins / totalNaturalTriggers) : null,
  cascadeRtp: round(baseCascadePayout / (baseSpins * bet)),
  naturalBonusContribution: round(baseBonusPayout / (baseSpins * bet)),
  combinedRtp: round((baseCascadePayout + baseBonusPayout) / (baseSpins * bet)),
  naturalBonusAverageFinalSpins: Object.fromEntries(
    [...naturalDuration.entries()].sort(([a], [b]) => a - b).map(([initial, value]) => [
      initial,
      round(value.spins / value.count),
    ]),
  ),
  cascadeDistribution: ordered(cascadeDistribution),
  multiplierDistribution: ordered(multiplierDistribution),
};

const featureCost = olympusFeatureBuyCost(bet);
let featurePayout = 0;
let featureSpinCount = 0;
let featureRetriggerCount = 0;
let featureWithRetrigger = 0;
let featureFinalLevelTotal = 0;
let featureMax = 0;
let sumSquares = 0;
const featureWins: number[] = [];
const levelDistribution = new Map<number, number>();
const gainDistribution = {
  zero: 0,
  belowCost: 0,
  oneToTwoCost: 0,
  twoToFiveCost: 0,
  fivePlusCost: 0,
};

for (let index = 0; index < featureBuys; index += 1) {
  const feature = planOlympusFeature(bet, undefined, rng);
  featurePayout += feature.payout;
  featureSpinCount += feature.finalSpins;
  featureRetriggerCount += feature.retriggers;
  if (feature.retriggers > 0) featureWithRetrigger += 1;
  featureFinalLevelTotal += feature.finalStormLevel;
  levelDistribution.set(feature.finalStormLevel, (levelDistribution.get(feature.finalStormLevel) ?? 0) + 1);
  featureMax = Math.max(featureMax, feature.payout);
  const winRelativeToBet = feature.payout / bet;
  featureWins.push(winRelativeToBet);
  sumSquares += winRelativeToBet * winRelativeToBet;

  if (feature.payout === 0) gainDistribution.zero += 1;
  else if (feature.payout < featureCost) gainDistribution.belowCost += 1;
  else if (feature.payout < featureCost * 2) gainDistribution.oneToTwoCost += 1;
  else if (feature.payout < featureCost * 5) gainDistribution.twoToFiveCost += 1;
  else gainDistribution.fivePlusCost += 1;
}

featureWins.sort((a, b) => a - b);
const median = featureWins.length % 2
  ? featureWins[Math.floor(featureWins.length / 2)] ?? 0
  : ((featureWins[featureWins.length / 2 - 1] ?? 0) + (featureWins[featureWins.length / 2] ?? 0)) / 2;
const averageWin = featurePayout / (featureBuys * bet);
const variance = Math.max(0, sumSquares / featureBuys - averageWin * averageWin);
const featureReport = {
  buys: featureBuys,
  bet,
  featureBuyCostMultiplier: OLYMPUS_FEATURE_BUY_COST_MULTIPLIER,
  featureBuyCost: featureCost,
  rtp: round(featurePayout / (featureBuys * featureCost)),
  averageWinRelativeToBet: round(averageWin),
  medianWinRelativeToBet: round(median),
  stddevRelativeToBet: round(Math.sqrt(variance)),
  maxWinRelativeToBet: round(featureMax / bet),
  averageFinalSpins: round(featureSpinCount / featureBuys),
  retriggerFrequency: percent(featureWithRetrigger / featureBuys),
  averageRetriggers: round(featureRetriggerCount / featureBuys),
  averageFinalStormLevel: round(featureFinalLevelTotal / featureBuys),
  finalStormLevelDistribution: Object.fromEntries(
    [...levelDistribution.entries()].sort(([a], [b]) => a - b).map(([level, count]) => [level, percent(count / featureBuys)]),
  ),
  level5Reached: percent((levelDistribution.get(5) ?? 0) / featureBuys),
  gainDistribution: Object.fromEntries(
    Object.entries(gainDistribution).map(([name, count]) => [name, percent(count / featureBuys)]),
  ),
};

console.log("OLYMPUS_BASE_REPORT");
console.log(JSON.stringify(baseReport, null, 2));
console.log("OLYMPUS_FEATURE_BUY_REPORT");
console.log(JSON.stringify(featureReport, null, 2));
