import { planOlympusRound } from "../src/lib/arcade/olympusStormMath";

const requested = Number(process.env.SPINS ?? 250_000);
const spins = Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : 250_000;

let state = 0x43f6a888;
function rng() {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4_294_967_296;
}

let totalPayout = 0;
let totalCascades = 0;
let totalStormHits = 0;
let hitSpins = 0;
let maxCascades = 0;
const cascadeDistribution = new Map<number, number>();
const multiplierDistribution = new Map<number, number>();

for (let index = 0; index < spins; index += 1) {
  const round = planOlympusRound(1, rng);
  totalPayout += round.payout;
  totalCascades += round.cascades.length;
  totalStormHits += round.stormHits;
  if (round.payout > 0) hitSpins += 1;
  maxCascades = Math.max(maxCascades, round.cascades.length);
  cascadeDistribution.set(
    round.cascades.length,
    (cascadeDistribution.get(round.cascades.length) ?? 0) + 1,
  );
  for (const cascade of round.cascades) {
    multiplierDistribution.set(
      cascade.multiplier,
      (multiplierDistribution.get(cascade.multiplier) ?? 0) + 1,
    );
  }
}

const percent = (value: number) => `${(value * 100).toFixed(4)}%`;
const round = (value: number) => Number(value.toFixed(6));
const ordered = (map: Map<number, number>) =>
  Object.fromEntries([...map.entries()].sort(([a], [b]) => a - b));

console.log(JSON.stringify({
  spins,
  grid: "6x5",
  clusterMinimum: 5,
  hitFrequency: percent(hitSpins / spins),
  averageCascades: round(totalCascades / spins),
  maxCascades,
  stormHitsPerSpin: round(totalStormHits / spins),
  payoutRelativeToBet: round(totalPayout / spins),
  cascadeDistribution: ordered(cascadeDistribution),
  multiplierDistribution: ordered(multiplierDistribution),
}, null, 2));
