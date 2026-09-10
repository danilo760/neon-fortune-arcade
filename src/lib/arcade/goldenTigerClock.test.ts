import assert from "node:assert/strict";
import test from "node:test";

import { GoldenTigerClock } from "./goldenTigerClock";

test("GoldenTigerClock schedule is inert outside the browser", async () => {
  const clock = new GoldenTigerClock();
  let fired = false;
  const cancel = clock.schedule(1, () => { fired = true; });
  cancel();
  await new Promise((resolve) => setTimeout(resolve, 4));
  clock.dispose();
  assert.equal(fired, false);
  assert.equal(clock.pendingCount, 0);
});
