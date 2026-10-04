import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGameweeks } from "@/lib/ultima/gameweek-builder";
import { pickCurrentGameweek, pickPreviousGameweek } from "@/lib/ultima/current-gameweek";

// The real 2026/27 shape: weekly windows from Fri 9 Oct, breaks 13-19 Nov and 26 Mar-1 Apr skipped.
const WEEK = 7 * 24 * 3600 * 1000;
const first = new Date("2026-10-09T00:00:00+04:00").getTime();
const breakIdx = new Set([5, 24]);
const fixtures = [];
for (let i = 0; i < 34; i += 1) {
  if (!breakIdx.has(i)) fixtures.push({ league: "pl", kickoff: new Date(first + i * WEEK + 36 * 3600 * 1000).toISOString() });
}
const { gameweeks: built } = buildGameweeks(fixtures, { firstFriday: "2026-10-09" });
const gws = built.map((g, i) => ({ id: `gw${g.number}`, number: g.number, state: "upcoming", window_start: g.window_start, window_end: g.window_end }));

const num = (now) => pickCurrentGameweek(gws, new Date(now))?.number ?? null;

test("builds the expected shape", () => {
  assert.equal(gws.length, 32);
});

test("before GW1, current is GW1 (not GW32)", () => {
  assert.equal(num("2026-10-04T15:00:00Z"), 1);
});

test("inside GW1, current is GW1", () => {
  assert.equal(num("2026-10-10T12:00:00Z"), 1);
  assert.equal(num("2026-10-08T20:00:00Z"), 1);
  assert.equal(num("2026-10-15T19:59:59Z"), 1);
});

test("the next window starts exactly after GW1 ends", () => {
  assert.equal(num("2026-10-15T20:00:00Z"), 2);
});

test("inside the November break, current is the next upcoming gameweek", () => {
  const during = pickCurrentGameweek(gws, new Date("2026-11-16T12:00:00Z"));
  assert.equal(during.number, 6);
  assert.equal(during.window_start, "2026-11-19T20:00:00.000Z");
});

test("after GW32, there is no current gameweek", () => {
  assert.equal(num("2027-06-10T00:00:00Z"), null);
});

test("a break only counts upcoming gameweeks", () => {
  const rows = gws.map((g) => (g.number === 6 ? { ...g, state: "final" } : g));
  assert.equal(pickCurrentGameweek(rows, new Date("2026-11-16T12:00:00Z"))?.number, 7);
});

test("previous is the latest gameweek whose window has ended", () => {
  assert.equal(pickPreviousGameweek(gws, new Date("2026-10-04T15:00:00Z")), null);
  assert.equal(pickPreviousGameweek(gws, new Date("2026-10-20T00:00:00Z"))?.number, 1);
  assert.equal(pickPreviousGameweek(gws, new Date("2027-06-10T00:00:00Z"))?.number, 32);
});
