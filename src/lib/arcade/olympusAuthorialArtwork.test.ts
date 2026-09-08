import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const artworkUrl = new URL("../../assets/olympus-storm/authorial-cabinet.svg", import.meta.url);
const legacyArtworkUrl = new URL("../../assets/olympus-storm/reference.webp", import.meta.url);
const tsconfigUrl = new URL("../../../tsconfig.json", import.meta.url);

test("Olympus Storm uses only the original storm artwork", () => {
  const artwork = readFileSync(fileURLToPath(artworkUrl), "utf8");
  const tsconfig = readFileSync(fileURLToPath(tsconfigUrl), "utf8");

  for (const symbol of ["sym-bolt", "sym-crown", "sym-chalice", "sym-coin", "sym-hammer", "sym-orb", "sym-zeus"]) {
    assert.match(artwork, new RegExp(`id=\\"${symbol}\\"`));
  }

  assert.match(tsconfig, /olympus-storm\/reference\.webp/);
  assert.match(tsconfig, /authorial-cabinet\.svg/);
  assert.equal(existsSync(fileURLToPath(legacyArtworkUrl)), false, "Legacy Olympus reference bitmap must stay deleted");
  assert.doesNotMatch(artwork, /(?:href|src)=["']https?:\/\//i);
});
