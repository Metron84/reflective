import test from "node:test";
import assert from "node:assert/strict";
import {
  summariseQuiz,
  summariseCodemaster,
  summariseGuesser,
  weekRank,
} from "@/lib/account/games-core.js";

const NOW = new Date("2026-10-14T10:00:00Z"); // Wednesday, Dubai day 2026-10-14
const WEEK = "2026-10-12";
const row = (extra) => ({
  score: 100,
  correct: 7,
  answered: 10,
  skipped: 0,
  counted: true,
  play_day: "2026-10-14",
  week_start: WEEK,
  completed_at: "2026-10-14T08:00:00+00:00",
  ...extra,
});

test("quiz tile: best, played and rank come from the member's own rows", () => {
  const rows = [row({ correct: 9, completed_at: "2026-10-13T08:00:00+00:00", play_day: "2026-10-13", counted: false }), row()];
  const leaders = [
    { rank: 1, score: 300, completed_at: "2026-10-12T08:00:00Z" },
    { rank: 2, score: 100, completed_at: "2026-10-14T08:00:00Z" },
  ];
  const q = summariseQuiz(rows, leaders, NOW);
  assert.equal(q.best, 9);
  assert.equal(q.played, 2);
  assert.equal(q.rank, 2);
});

test("quiz tile: daily spin is open until a counted game exists for the Dubai day", () => {
  assert.equal(summariseQuiz([], [], NOW).openToday, true);
  assert.equal(summariseQuiz([row({ counted: false })], [], NOW).openToday, true);
  assert.equal(summariseQuiz([row()], [], NOW).openToday, false);
  // 21:30 UTC is already the next Dubai day.
  assert.equal(summariseQuiz([row()], [], new Date("2026-10-14T21:30:00Z")).openToday, true);
});

test("weekRank is null with no counted game this week", () => {
  assert.equal(weekRank([row({ counted: false })], [], WEEK), null);
});

const meta = {
  ranks: [
    { key: "rookie", title: "Rookie", at: 0 },
    { key: "scout", title: "Scout", at: 67 },
  ],
  totalPuzzles: 670,
  rankFor: (n, ranks) => [...ranks].reverse().find((r) => n >= r.at),
};

test("codemaster tile: title, ranked-up flag and in-progress", () => {
  assert.deepEqual(summariseCodemaster(0, meta), {
    solved: 0, title: "Rookie", hasRankedUp: false, inProgress: false, rankedUpAt: 67,
  });
  const c = summariseCodemaster(70, meta);
  assert.equal(c.title, "Scout");
  assert.equal(c.hasRankedUp, true);
  assert.equal(c.inProgress, true);
  assert.equal(summariseCodemaster(670, meta).inProgress, false);
});

const board = (day, pts) => ({
  mode: "buzzer",
  puzzle_date: day,
  guesses: { players: pts.map((p, i) => ({ st: "done", pts: p, ok: p > 0, pid: p > 0 ? `x${i}` : null })) },
});

test("guesser tile: today's score out of 20, best score and boards played", () => {
  const rows = [board("2026-10-13", [4, 4, 4, 3, 3]), board("2026-10-14", [1, 0, 2, 0, 0])];
  const g = summariseGuesser(rows, NOW); // NOW is Dubai day 2026-10-14
  assert.deepEqual(g, { boards: 2, today: 3, best: 18, max: 20 });
});

test("guesser tile: nothing played yet", () => {
  assert.deepEqual(summariseGuesser([], NOW), { boards: 0, today: null, best: null, max: 20 });
});

test("guesser tile: a board still in progress is not a score", () => {
  const open = { mode: "buzzer", puzzle_date: "2026-10-14", guesses: { players: [{ st: "done", pts: 4 }, { st: "live" }] } };
  assert.equal(summariseGuesser([open], NOW).today, null);
  assert.equal(summariseGuesser([open], NOW).boards, 0);
});
