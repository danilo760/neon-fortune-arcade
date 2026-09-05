import { planCandyFeature } from "../src/lib/arcade/candyCascadeMath";

const SAMPLES = 1_000_000;
function lcg(seed: number) {
  let state = seed >>> 0;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const rng = lcg(0x5a6a7c11);
const histogram = new Uint32Array(31);
let energySum = 0;
let maxEnergy = 0;
for (let index = 0; index < SAMPLES; index += 1) {
  const plan = planCandyFeature(100, 10, rng);
  const energy = plan.finalSugarEnergy;
  energySum += energy;
  maxEnergy = Math.max(maxEnergy, energy);
  histogram[Math.min(30, energy)] += 1;
}
const tail = (threshold: number) => {
  let total = 0;
  for (let energy = threshold; energy < histogram.length; energy += 1) total += histogram[energy] ?? 0;
  return total / SAMPLES;
};
console.log("CANDY_METER_ENERGY", JSON.stringify({
  samples: SAMPLES,
  averageEnergy: energySum / SAMPLES,
  maxEnergy,
  histogram: Array.from(histogram, (count, energy) => ({ energy: energy === 30 ? "30+" : energy, count, rate: count / SAMPLES })),
  tails: Array.from({ length: 11 }, (_, threshold) => ({ threshold, rate: tail(threshold) })),
}));
