import { readFile, writeFile } from "node:fs/promises";

const mathPath = "src/lib/arcade/candyCascadeMath.ts";
const testPath = "src/lib/arcade/candyCascadeMath.test.ts";

const math = await readFile(mathPath, "utf8");
const oldThresholds = "export const CANDY_SUGAR_LEVEL_THRESHOLDS = [0, 1, 3, 6, 10] as const;";
if (math.includes(oldThresholds)) {
  const replacement = `// 1,000,000-feature energy analysis: P(E>=1)=58.14%, >=2=22.83%,\n// >=3=6.91%, >=4=1.74%. These thresholds keep all five levels meaningful\n// while leaving Level 5 uncommon rather than practically unreachable.\nexport const CANDY_SUGAR_LEVEL_THRESHOLDS = [0, 1, 2, 3, 4] as const;`;
  await writeFile(mathPath, math.replace(oldThresholds, replacement), "utf8");
}

const test = await readFile(testPath, "utf8");
const oldAssertions = `  assert.equal(candySugarLevel(0), 1);\n  assert.equal(candySugarLevel(1), 2);\n  assert.equal(candySugarLevel(3), 3);\n  assert.equal(candySugarLevel(6), 4);\n  assert.equal(candySugarLevel(10), 5);`;
if (test.includes(oldAssertions)) {
  const replacement = `  assert.equal(candySugarLevel(0), 1);\n  assert.equal(candySugarLevel(1), 2);\n  assert.equal(candySugarLevel(2), 3);\n  assert.equal(candySugarLevel(3), 4);\n  assert.equal(candySugarLevel(4), 5);`;
  await writeFile(testPath, test.replace(oldAssertions, replacement), "utf8");
}

console.log("Candy Sugar Meter calibration patch checked.");
