import { readFile } from "node:fs/promises";

const reportPath = process.env.GOLDEN_TIGER_REPORT ?? "artifacts/golden-tiger/report.json";
const report = JSON.parse(await readFile(reportPath, "utf8"));
const failures = [];

for (const item of report) {
  const { width, height } = item.viewport;
  const label = `${width}x${height}`;

  for (const [stateName, audit] of [["idle", item.idle], ["spin", item.spinning]]) {
    if (!audit?.sprite) {
      failures.push(`${label} ${stateName}: missing mascot bounds`);
      continue;
    }

    // The atlas cell may contain transparent padding, so this is deliberately
    // a geometric safety floor rather than a pixel-perfect art assertion.
    if (height > 760 && audit.sprite.top < 32) {
      failures.push(`${label} ${stateName}: mascot enters brand safe zone (${audit.sprite.top.toFixed(1)}px)`);
    }
  }

  if (height >= 820) {
    const grid = item.idle?.grid;
    if (!grid) {
      failures.push(`${label}: missing grid bounds`);
      continue;
    }

    const topRatio = grid.top / height;
    const bottomRatio = grid.bottom / height;
    if (topRatio > 0.335) {
      failures.push(`${label}: excessive dead space above grid (${(topRatio * 100).toFixed(1)}% viewport)`);
    }
    if (bottomRatio > 0.74) {
      failures.push(`${label}: grid/status stack pushed too low (${(bottomRatio * 100).toFixed(1)}% viewport)`);
    }
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`❌ ${failure}`);
  process.exitCode = 1;
} else {
  console.log("✅ Golden Tiger composition guard passed");
}
