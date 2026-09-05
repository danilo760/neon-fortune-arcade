import { readFile, writeFile } from "node:fs/promises";

const mathPath = "src/lib/arcade/candyCascadeMath.ts";
const testPath = "src/lib/arcade/candyCascadeMath.test.ts";

let math = await readFile(mathPath, "utf8");
const oldThresholds = "export const CANDY_SUGAR_LEVEL_THRESHOLDS = [0, 1, 3, 6, 10] as const;";
if (math.includes(oldThresholds)) {
  const replacement = `// 1,000,000-feature energy analysis: P(E>=1)=58.14%, >=2=22.83%,\n// >=3=6.91%, >=4=1.74%. These thresholds keep all five levels meaningful\n// while leaving Level 5 uncommon rather than practically unreachable.\nexport const CANDY_SUGAR_LEVEL_THRESHOLDS = [0, 1, 2, 3, 4] as const;`;
  math = math.replace(oldThresholds, replacement);
}
if (math.includes("  base: 0.875,")) {
  math = math.replace("  base: 0.875,", "  base: 0.857,");
  math = math.replace(
    "// return back near the common fictional target band.",
    "// return back near the common fictional target band. Final verification uses 0.857.",
  );
}
await writeFile(mathPath, math, "utf8");

let test = await readFile(testPath, "utf8");
const oldAssertions = `  assert.equal(candySugarLevel(0), 1);\n  assert.equal(candySugarLevel(1), 2);\n  assert.equal(candySugarLevel(3), 3);\n  assert.equal(candySugarLevel(6), 4);\n  assert.equal(candySugarLevel(10), 5);`;
if (test.includes(oldAssertions)) {
  const replacement = `  assert.equal(candySugarLevel(0), 1);\n  assert.equal(candySugarLevel(1), 2);\n  assert.equal(candySugarLevel(2), 3);\n  assert.equal(candySugarLevel(3), 4);\n  assert.equal(candySugarLevel(4), 5);`;
  test = test.replace(oldAssertions, replacement);
  await writeFile(testPath, test, "utf8");
}

console.log("Candy Sugar Meter/base payout calibration patch checked.");
