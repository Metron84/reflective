import assert from "node:assert/strict";
import { test } from "node:test";
import { validateDraftSlots } from "../../lib/ultima/draft/validate-slots.js";

const seats = (...slots) => slots.map((draft_slot) => ({ draft_slot }));

test("slots 1..N in any row order are valid", () => {
  assert.deepEqual(validateDraftSlots(seats(3, 1, 2)), { ok: true, count: 3 });
  assert.equal(validateDraftSlots(seats(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)).ok, true);
  assert.equal(validateDraftSlots(seats(1)).ok, true);
});

test("nulls, missing and non-integer slots are invalid", () => {
  for (const bad of [[1, null], [1, undefined], [1, "2"], [1, 2.5]]) {
    const r = validateDraftSlots(seats(...bad));
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.match(r.reason, /no draft slot/);
  }
});

test("duplicates are invalid", () => {
  const r = validateDraftSlots(seats(1, 2, 2, 4));
  assert.equal(r.ok, false);
  assert.match(r.reason, /slot 2 is used twice/);
});

test("gaps and a start other than 1 are invalid", () => {
  assert.match(validateDraftSlots(seats(1, 2, 4)).reason, /slot 3 is missing/);
  assert.match(validateDraftSlots(seats(2, 3, 4)).reason, /slot 1 is missing/);
  assert.match(validateDraftSlots(seats(0, 1, 2)).reason, /slot 1 is missing/);
});

test("nobody seated is invalid", () => {
  assert.equal(validateDraftSlots([]).ok, false);
  assert.equal(validateDraftSlots(undefined).ok, false);
});
