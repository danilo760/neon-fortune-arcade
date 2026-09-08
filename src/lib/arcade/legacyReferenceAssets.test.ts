import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const LEGACY_REFERENCE_ASSETS = [
  new URL("../../assets/neon-mines-reference.webp", import.meta.url),
  new URL("../../assets/neon-plinko-reference.webp", import.meta.url),
] as const;

for (const assetUrl of LEGACY_REFERENCE_ASSETS) {
  test(`legacy reference asset stays removed or reduced to a tiny compatibility shim: ${assetUrl.pathname.split("/").pop()}`, () => {
    const path = fileURLToPath(assetUrl);
    if (!existsSync(path)) return;

    const size = statSync(path).size;
    assert.ok(
      size <= 512,
      `Legacy reference artwork returned at ${size} bytes. Keep the compatibility shim tiny or remove the import entirely.`,
    );
  });
}
