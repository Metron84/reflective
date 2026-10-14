import test from "node:test";
import assert from "node:assert/strict";
import { headerPending, initialsOf } from "@/lib/account/header-status.js";
import { formatMemberNumber } from "@/lib/auth/config.js";

const none = { quizOpen: false, unrevealed: 0, codemasterInProgress: false };

test("the dot shows for each pending action Next up knows about", () => {
  assert.equal(headerPending({ ...none, quizOpen: true }), true);
  assert.equal(headerPending({ ...none, unrevealed: 3 }), true);
  assert.equal(headerPending({ ...none, codemasterInProgress: true }), true);
});

test("no dot when Next up would only offer the fallback spin", () => {
  assert.equal(headerPending(none), false);
});

test("initials are the first letters of the first two words", () => {
  assert.equal(initialsOf("Melo"), "M");
  assert.equal(initialsOf("melo doumani"), "MD");
  assert.equal(initialsOf("  Ana  Maria  Silva "), "AM");
  assert.equal(initialsOf("Émile"), "É");
  assert.equal(initialsOf(""), "?");
  assert.equal(initialsOf(null), "?");
});

test("member number shows as #0003", () => {
  assert.equal(formatMemberNumber(3), "#0003");
  assert.equal(formatMemberNumber(1234), "#1234");
  assert.equal(formatMemberNumber(null), "#0001");
});
