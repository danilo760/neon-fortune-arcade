import { readFile, writeFile } from "node:fs/promises";

const path = "src/components/arcade/CandyCascadeHQ.tsx";
const source = await readFile(path, "utf8");
const startMarker = "    for (let step = 0; step < (turbo ? 4 : 8); step += 1) {";
const endMarker = "    const basePayout = await presentRound(plan, false);";
const start = source.indexOf(startMarker);
if (start < 0) {
  console.log("Candy spin loop already absent; nothing to patch.");
  process.exit(0);
}
const end = source.indexOf(endMarker, start);
if (end < 0) throw new Error("Candy base payout marker not found");
const replacement = `    // The result is already precomputed. Keep the existing grid mounted and let\n    // .cc-grid.is-spinning animate it on the compositor instead of rebuilding\n    // 30 React cells several times just to fake reel motion.\n    await wait(turbo ? 190 : 470);\n    setGrid(plan.initialGrid);\n    await wait(turbo ? 55 : 140);\n\n`;
await writeFile(path, source.slice(0, start) + replacement + source.slice(end), "utf8");
console.log("Candy spin loop patched.");
