import test from "node:test";
import assert from "node:assert/strict";
import { EXCLUDED_PERSON_IDS, getAutocompleteList, getBuzzerOrder, getBuzzerPool, resolveGuessText, scheduledBoardIds } from "@/lib/guesser/buzzer/pool.js";
import { BOARD_SIZE, MIN_GAP_DAYS, boardForDay, minGapDays, windowsValid } from "@/lib/guesser/buzzer/schedule.js";
import { filterNames } from "@/lib/guesser/buzzer/names.js";
import { getAllRows } from "@/lib/guesser/registry.js";

const pool = getBuzzerPool();
const leagueOf = new Map(pool.map((p) => [p.personId, p.league]));

test("the pool is the 291 people with four real clues, and nobody flagged", () => {
  assert.equal(pool.length, 291);
  const ids = new Set(pool.map((p) => p.personId));
  for (const id of EXCLUDED_PERSON_IDS) assert.ok(!ids.has(id), `${id} should be excluded`);
  assert.equal(EXCLUDED_PERSON_IDS.length, 25);
  for (const p of pool) {
    assert.equal(p.clues.length, 4);
    for (const c of p.clues) {
      assert.ok(c.length >= 25, `${p.personId} clue too short`);
      assert.ok(!c.toUpperCase().startsWith("SAMPLE"), `${p.personId} has placeholder text`);
    }
  }
});

test("no SAMPLE placeholder person is ever in the pool", () => {
  const placeholders = new Set(getAllRows().filter((r) => r.clues.some((c) => c.toUpperCase().startsWith("SAMPLE"))).map((r) => r.person_id));
  assert.ok(placeholders.size > 250);
  for (const p of pool) assert.ok(!placeholders.has(p.personId));
});

test("the order holds every pool member once and keeps every run of five league-mixed", () => {
  const order = getBuzzerOrder();
  assert.equal(order.length, pool.length);
  assert.equal(new Set(order).size, pool.length);
  assert.ok(windowsValid(order, (id) => leagueOf.get(id)));
});

test("a board is five different players from at least three leagues, every day", () => {
  const order = getBuzzerOrder();
  for (let d = 0; d < 700; d += 1) {
    const board = boardForDay(order, d);
    assert.equal(board.length, BOARD_SIZE);
    assert.equal(new Set(board).size, BOARD_SIZE);
    assert.ok(new Set(board.map((id) => leagueOf.get(id))).size >= 3, `day ${d}`);
  }
});

test("nobody returns within 58 days", () => {
  assert.ok(minGapDays(getBuzzerOrder(), 2000) >= MIN_GAP_DAYS);
});

test("the schedule is stable: the same day always gives the same five", () => {
  assert.deepEqual(scheduledBoardIds("2026-10-15"), scheduledBoardIds("2026-10-15"));
  assert.notDeepEqual(scheduledBoardIds("2026-10-15"), scheduledBoardIds("2026-10-16"));
});

test("autocomplete lists everyone, not only the pool", () => {
  const list = getAutocompleteList();
  assert.equal(list.length, 614);
  assert.ok(list.some(([id]) => id === "isco")); // an excluded player is still guessable
});

test("typed names resolve by full name, alias or surname, and shared surnames ask", () => {
  assert.deepEqual(resolveGuessText("Diego Maradona"), { type: "one", personId: "diego-maradona" });
  assert.deepEqual(resolveGuessText("maradona"), { type: "one", personId: "diego-maradona" });
  assert.deepEqual(resolveGuessText("El Diego"), { type: "one", personId: "diego-maradona" });
  assert.equal(resolveGuessText("silva").type, "ambiguous");
  assert.equal(resolveGuessText("qqqq").type, "none");
  assert.equal(resolveGuessText("").type, "none");
});

test("autocomplete filter matches name starts, surnames and aliases", () => {
  const list = getAutocompleteList();
  const ids = (q) => filterNames(list, q).map(([id]) => id);
  assert.ok(ids("diego m").includes("diego-maradona"));
  assert.ok(ids("marad").includes("diego-maradona"));
  assert.ok(ids("el die").includes("diego-maradona"));
  assert.deepEqual(filterNames(list, ""), []);
  assert.ok(filterNames(list, "a", 6).length <= 6);
});
