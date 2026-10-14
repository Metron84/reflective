import test from "node:test";
import assert from "node:assert/strict";
import { BADGE_DEFS } from "@/lib/account/badges.js";
import { parseBuzzerBoards, bestRun, summariseGuesser } from "@/lib/account/buzzer-stats.js";
import { getBuzzerPool, isWorldCupPerson } from "@/lib/guesser/buzzer/pool.js";

const def = (slug) => BADGE_DEFS.find((d) => d.slug === slug);
const play = (day, pts, pids = []) => ({
  mode: "buzzer",
  puzzle_date: day,
  guesses: {
    players: pts.map((p, i) => ({ st: "done", pts: p, ok: p > 0, pid: p > 0 ? (pids[i] ?? `p${day}${i}`) : null })),
  },
});
const ctx = (plays) => ({ quizRows: [], codemaster: {}, buzzer: parseBuzzerBoards(plays) });

test("unfinished boards and other modes are ignored", () => {
  const live = { mode: "buzzer", puzzle_date: "2026-10-01", guesses: { players: [{ st: "done", pts: 4 }, { st: "live" }] } };
  const old = { mode: "classic", puzzle_date: "2026-10-01", guesses: [] };
  assert.equal(parseBuzzerBoards([live, old]).length, 0);
});

test("The Purist: a correct answer on clue 1 (4 points)", () => {
  assert.equal(def("the_purist").check(ctx([play("2026-10-01", [3, 3, 2, 1, 0])])), false);
  assert.equal(def("the_purist").check(ctx([play("2026-10-01", [3, 4, 0, 0, 0])])), true);
});

test("The Deducer: board score 16 or more", () => {
  assert.equal(def("the_deducer").check(ctx([play("2026-10-01", [4, 4, 4, 3, 0])])), false);
  assert.equal(def("the_deducer").check(ctx([play("2026-10-01", [4, 4, 4, 4, 0])])), true);
});

test("Week of Wins and Month of Wins need consecutive Dubai days scoring 10 or more", () => {
  const days = (n, from = 1, pts = [2, 2, 2, 2, 2]) =>
    Array.from({ length: n }, (_, i) => play(`2026-09-${String(from + i).padStart(2, "0")}`, pts));
  assert.equal(bestRun(parseBuzzerBoards(days(6)), 10), 6);
  assert.equal(def("week_of_wins").check(ctx(days(6))), false);
  assert.equal(def("week_of_wins").check(ctx(days(7))), true);
  assert.equal(def("month_of_wins").check(ctx(days(29))), false);
  assert.equal(def("month_of_wins").check(ctx(days(30))), true);
  // a gap or a low-scoring day breaks the run
  assert.equal(def("week_of_wins").check(ctx([...days(3), ...days(4, 5)])), false);
  assert.equal(def("week_of_wins").check(ctx([...days(7, 1, [1, 1, 1, 1, 1])])), false);
});

test("The Historian: ten distinct World Cup Legends named across boards", () => {
  const wc = getBuzzerPool().filter((p) => isWorldCupPerson(p.personId)).slice(0, 10).map((p) => p.personId);
  assert.equal(wc.length, 10);
  const nine = [play("2026-10-01", [1, 1, 1, 1, 1], wc.slice(0, 5)), play("2026-10-02", [1, 1, 1, 1, 0], wc.slice(5, 9))];
  const ten = [...nine.slice(0, 1), play("2026-10-02", [1, 1, 1, 1, 1], wc.slice(5, 10))];
  assert.equal(def("the_historian").check(ctx(nine)), false);
  assert.equal(def("the_historian").check(ctx(ten)), true);
  // naming the same person twice counts once
  assert.equal(def("the_historian").check(ctx([play("2026-10-01", [1, 1, 1, 1, 1], wc.slice(0, 5)), play("2026-10-02", [1, 1, 1, 1, 1], wc.slice(0, 5))])), false);
});

test("tile summary: today, best, played", () => {
  const s = summariseGuesser([play("2026-10-13", [4, 4, 4, 4, 0]), play("2026-10-14", [1, 0, 0, 0, 0])], "2026-10-14");
  assert.deepEqual(s, { boards: 2, today: 1, best: 16, max: 20 });
});
