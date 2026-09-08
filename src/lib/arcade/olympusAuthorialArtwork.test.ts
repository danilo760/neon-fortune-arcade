import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const artworkUrl = new URL("../../assets/olympus-storm/authorial-cabinet.svg", import.meta.url);
const viteConfigUrl = new URL("../../../vite.config.ts", import.meta.url);

test("Olympus Storm routes the legacy reference import to original artwork", () => {
  const artwork = readFileSync(fileURLToPath(artworkUrl), "utf8");
  const viteConfig = readFileSync(fileURLToPath(viteConfigUrl), "utf8");

  for (const symbol of ["sym-bolt", "sym-crown", "sym-chalice", "sym-coin", "sym-hammer", "sym-orb", "sym-zeus"]) {
    assert.match(artwork, new RegExp(`id=\\"${symbol}\\"`));
  }

  assert.match(viteConfig, /olympus-storm\/reference\.webp/);
  assert.match(viteConfig, /authorial-cabinet\.svg/);
  assert.doesNotMatch(artwork, /https?:\/\//);
});
