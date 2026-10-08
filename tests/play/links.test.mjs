import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FANS_LABEL, FANS_LINE, FANS_URL } from "@/lib/play/links.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("fans button copy and link", () => {
  assert.equal(FANS_LABEL, "CHECK OUT THE FANS");
  assert.equal(FANS_URL, "https://www.instagram.com/thereflectivefootball/");
  assert.equal(FANS_LINE, "See the fans behind the game.");
  const btn = read("components/play/FansButton.js");
  assert.match(btn, /target="_blank"/);
  assert.match(btn, /rel="noopener noreferrer"/);
});

test("no play screen links to /films or says Watch the films", () => {
  for (const f of ["app/play/page.js", "components/play/PlayGame.js", "components/play/EndScreen.js"]) {
    const src = read(f);
    assert.doesNotMatch(src, /\/films/, f);
    assert.doesNotMatch(src, /Watch (the )?films/i, f);
  }
});
