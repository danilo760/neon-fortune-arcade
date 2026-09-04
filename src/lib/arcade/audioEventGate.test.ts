import assert from "node:assert/strict";
import test from "node:test";

import { AudioEventGate, simulatePlinkoPegAdmission } from "./audioEventGate";

test("Plinko peg gate suppresses a dense burst without silencing the sequence", () => {
  const result = simulatePlinkoPegAdmission(16, 10, 88);
  assert.equal(result.attempted, 80);
  assert.ok(result.admitted >= 30, `expected enough audible peg events, got ${result.admitted}`);
  assert.ok(result.admitted <= 40, `expected a material reduction, got ${result.admitted}`);
});

test("Plinko peg gate enforces cooldown and later admits the next voice", () => {
  const gate = new AudioEventGate();
  assert.equal(gate.allow("plinkoPeg", 0), true);
  assert.equal(gate.allow("plinkoPeg", 10), false);
  assert.equal(gate.allow("plinkoPeg", 29), false);
  assert.equal(gate.allow("plinkoPeg", 30), true);
});
