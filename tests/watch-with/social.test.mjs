import assert from "node:assert/strict";
import test from "node:test";
import { fanPickPercent } from "../../lib/watch-with/social.js";

test("fan proof stays hidden under 30 completed fan runs", () => {
  assert.equal(fanPickPercent(29, 29), null);
  assert.equal(fanPickPercent(10, 29), null);
});

test("fan proof uses the floor, never a rounded-up percent", () => {
  assert.equal(fanPickPercent(1, 30), 3);
  assert.equal(fanPickPercent(15, 30), 50);
  assert.equal(fanPickPercent(0, 40), 0);
});
