import { CANDY_FEATURE_BUY_COST_MULTIPLIER } from "../src/lib/arcade/candyCascadeFeatureBuy";
import { planCandyFeature, planCandyRound } from "../src/lib/arcade/candyCascadeMath";

const BASE_SPINS = Number(process.env.CANDY_BASE_SPINS ?? 1_000_000);
const FEATURE_BUYS = Number(process.env.CANDY_FEATURE_BUYS ?? 1_000_000);
const BET = 100;

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const baseRng = lcg(0x51a9cafe);
let basePayout = 0;
let naturalBonusPayout = 0;
let baseHits = 0;
let bonusTriggers = 0;
let cascades = 0;
let bombs = 0;
const scatterDistribution = new Uint32Array(7);

for (let index = 0; index < BASE_SPINS; index += 1) {
  const round = planCandyRound(BET, baseRng, "base");
  basePayout += round.payout;
  cascades += round.cascades.length;
  bombs += round.bombs;
  if (round.payout > 0) baseHits += 1;
  scatterDistribution[Math.min(6, round.scatterCount)] += 1;
  if (round.scatterAward > 0) {
    bonusTriggers += 1;
    const feature = planCandyFeature(BET, round.scatterAward, baseRng);
    naturalBonusPayout += feature.payout;
  }
}

const featureRng = lcg(0xc0ffee11);
const payouts = new Float64Array(FEATURE_BUYS);
let featurePayout = 0;
let featureSpins = 0;
let featureRetriggers = 0;
let featureWithRetrigger = 0;
let featureFinalLevel = 0;
let featureLevel5 = 0;
let featureMax = 0;
let zero = 0;
let belowCost = 0;
let oneToTwoCost = 0;
let twoToFiveCost = 0;
let fivePlusCost = 0;
const featureCost = BET * CANDY_FEATURE_BUY_COST_MULTIPLIER;

for (let index = 0; index < FEATURE_BUYS; index += 1) {
  const feature = planCandyFeature(BET, 10, featureRng);
  const payout = feature.payout;
  payouts[index] = payout;
  featurePayout += payout;
  featureSpins += feature.finalSpins;
  featureRetriggers += feature.retriggers;
  if (feature.retriggers > 0) featureWithRetrigger += 1;
  featureFinalLevel += feature.finalSugarLevel;
  if (feature.finalSugarLevel === 5) featureLevel5 += 1;
  featureMax = Math.max(featureMax, payout);
  if (payout === 0) zero += 1;
  if (payout < featureCost) belowCost += 1;
  else if (payout < featureCost * 2) oneToTwoCost += 1;
  else if (payout < featureCost * 5) twoToFiveCost += 1;
  else fivePlusCost += 1;
}

const avgFeature = featurePayout / FEATURE_BUYS;
let varianceSum = 0;
for (const payout of payouts) varianceSum += (payout - avgFeature) ** 2;
payouts.sort();
const median = payouts[Math.floor(FEATURE_BUYS / 2)] ?? 0;

const report = {
  samples: { baseSpins: BASE_SPINS, featureBuys: FEATURE_BUYS, bet: BET },
  base: {
    baseRtp: basePayout / (BASE_SPINS * BET),
    naturalBonusContribution: naturalBonusPayout / (BASE_SPINS * BET),
    totalRtp: (basePayout + naturalBonusPayout) / (BASE_SPINS * BET),
    hitFrequency: baseHits / BASE_SPINS,
    bonusFrequency: bonusTriggers / BASE_SPINS,
    oneBonusEvery: bonusTriggers > 0 ? BASE_SPINS / bonusTriggers : null,
    cascadesPerSpin: cascades / BASE_SPINS,
    sugarBombFrequency: bombs / BASE_SPINS,
    scatterDistribution: Array.from(scatterDistribution, (count, scatters) => ({ scatters, count, rate: count / BASE_SPINS })),
  },
  featureBuy: {
    costXBet: CANDY_FEATURE_BUY_COST_MULTIPLIER,
    rtp: avgFeature / featureCost,
    averageWinXBet: avgFeature / BET,
    medianXBet: median / BET,
    stddevXBet: Math.sqrt(varianceSum / FEATURE_BUYS) / BET,
    maxObservedXBet: featureMax / BET,
    averageSpins: featureSpins / FEATURE_BUYS,
    retriggerFrequency: featureWithRetrigger / FEATURE_BUYS,
    averageRetriggers: featureRetriggers / FEATURE_BUYS,
    averageFinalSugarLevel: featureFinalLevel / FEATURE_BUYS,
    level5Frequency: featureLevel5 / FEATURE_BUYS,
    distribution: {
      zero: zero / FEATURE_BUYS,
      belowCost: belowCost / FEATURE_BUYS,
      oneToTwoCost: oneToTwoCost / FEATURE_BUYS,
      twoToFiveCost: twoToFiveCost / FEATURE_BUYS,
      fivePlusCost: fivePlusCost / FEATURE_BUYS,
    },
  },
};

console.log("CANDY_SUGAR_PARTY_SIM", JSON.stringify(report));

if (report.base.oneBonusEvery === null || report.base.oneBonusEvery < 60 || report.base.oneBonusEvery > 100) {
  throw new Error(`Candy natural bonus frequency outside 1/60..1/100: ${report.base.oneBonusEvery}`);
}
if (report.featureBuy.rtp < 0.94 || report.featureBuy.rtp > 0.97) {
  throw new Error(`Candy Feature Buy RTP outside 94%..97% calibration gate: ${report.featureBuy.rtp}`);
}
