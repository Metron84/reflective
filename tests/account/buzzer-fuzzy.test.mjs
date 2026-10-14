import test from "node:test";
import assert from "node:assert/strict";
import { withinOneEdit } from "@/lib/guesser/buzzer/fuzzy.js";

test("within one edit: replace, insert, delete, same", () => {
  assert.equal(withinOneEdit("messi", "messi"), true);
  assert.equal(withinOneEdit("messi", "mesi"), true);
  assert.equal(withinOneEdit("messi", "messie"), true);
  assert.equal(withinOneEdit("messi", "mossi"), true);
  assert.equal(withinOneEdit("messi", "mesi!"), false);
  assert.equal(withinOneEdit("messi", "mesis"), false);
  assert.equal(withinOneEdit("messi", "meessi x"), false);
  assert.equal(withinOneEdit("ab", "ba"), false); // a swap is two edits
});
