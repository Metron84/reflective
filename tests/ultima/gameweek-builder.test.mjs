import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGameweeks } from "@/lib/ultima/gameweek-builder";

const fx = (league, kickoff) => ({ league, kickoff });

test("windows run Friday 00:00 to Thursday 23:59:59 Dubai, stored in UTC", () => {
  const { gameweeks } = buildGameweeks([fx("pl", "2026-10-10T11:30:00Z")], { firstFriday: "2026-10-09" });
  assert.equal(gameweeks.length, 1);
  assert.equal(gameweeks[0].number, 1);
  assert.equal(gameweeks[0].window_start, "2026-10-08T20:00:00.000Z");
  assert.equal(gameweeks[0].window_end, "2026-10-15T19:59:59.000Z");
});

test("empty windows are skipped and get no number", () => {
  const { gameweeks, skipped } = buildGameweeks(
    [fx("pl", "2026-10-10T14:00:00Z"), fx("laliga", "2026-10-24T14:00:00Z")],
    { firstFriday: "2026-10-09" },
  );
  assert.deepEqual(gameweeks.map((g) => g.number), [1, 2]);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].windowStart.toISOString(), "2026-10-15T20:00:00.000Z");
});

test("league_open_at holds each league's first kickoff and omits idle leagues", () => {
  const { gameweeks } = buildGameweeks(
    [fx("pl", "2026-10-10T14:00:00Z"), fx("pl", "2026-10-09T18:00:00Z"), fx("ligue1", "2026-10-11T19:45:00Z")],
    { firstFriday: "2026-10-09" },
  );
  assert.deepEqual(gameweeks[0].league_open_at, {
    pl: "2026-10-09T22:00:00+04:00",
    ligue1: "2026-10-11T23:45:00+04:00",
  });
  assert.deepEqual(gameweeks[0].fixture_counts, { pl: 2, ligue1: 1 });
});

test("a Thursday late kickoff stays in its window; Friday after midnight GST starts the next", () => {
  const { gameweeks } = buildGameweeks(
    [fx("pl", "2026-10-15T19:59:00Z"), fx("pl", "2026-10-15T20:00:00Z")],
    { firstFriday: "2026-10-09" },
  );
  assert.deepEqual(gameweeks.map((g) => g.number), [1, 2]);
});

test("fixtures before the first window are ignored and a non-Friday start is rejected", () => {
  assert.deepEqual(buildGameweeks([fx("pl", "2026-10-01T14:00:00Z")], { firstFriday: "2026-10-09" }).gameweeks, []);
  assert.throws(() => buildGameweeks([], { firstFriday: "2026-10-10" }), /not a Friday/);
});
