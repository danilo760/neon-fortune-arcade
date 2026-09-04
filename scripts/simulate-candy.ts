import { planCandyRound } from "../src/lib/arcade/candyCascadeMath";

const requested = Number(process.env.SPINS ?? 250_000);
const spins = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 250_000;
const bet = 100;
let state = 0x6d2b79f5;
const rng = () => {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4294967296;
};

let payout = 0;
let hits = 0;
let cascades = 0;
let bombs = 0;
let maxCascades = 0;
const cascadeDistribution = new Map<number, number>();
for (let index = 0; index < spins; index += 1) {
  const round = planCandyRound(bet, rng);
  payout += round.payout;
  if (round.payout > 0) hits += 1;
  cascades += round.cascades.length;
  bombs += round.bombs;
  maxCascades = Math.max(maxCascades, round.cascades.length);
  cascadeDistribution.set(round.cascades.length, (cascadeDistribution.get(round.cascades.length) ?? 0) + 1);
}
const percent = (value: number) => `${(value * 100).toFixed(4)}%`;
console.log(JSON.stringify({
  spins,
  grid: "6x5",
  hitFrequency: percent(hits / spins),
  averageCascades: Number((cascades / spins).toFixed(6)),
  maxCascades,
  bombFrequencyPerSpin: Number((bombs / spins).toFixed(6)),
  payoutRelativeToBet: Number((payout / (spins * bet)).toFixed(6)),
  cascadeDistribution: Object.fromEntries([...cascadeDistribution.entries()].sort(([a], [b]) => a - b)),
}, null, 2));
