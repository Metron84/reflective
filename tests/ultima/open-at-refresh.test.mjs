import assert from "node:assert/strict";
import { test } from "node:test";
import { applyOpenAtRefresh, planOpenAtRefresh } from "@/lib/ultima/gameweek-refresh";
import { makeFakeDb } from "./helpers/fake-db.mjs";

const NOW = new Date("2026-10-04T10:00:00Z");

const gw = (over = {}) => ({
  id: "gw1",
  number: 1,
  state: "upcoming",
  window_start: "2026-10-08T20:00:00.000Z",
  window_end: "2026-10-15T19:59:59.000Z",
  league_open_at: {},
  ...over,
});
const fx = (league, kickoff) => ({ league, kickoff });

test("a placeholder 04:00 open time is replaced by the first real kickoff", () => {
  const plan = planOpenAtRefresh({
    gameweeks: [gw({ league_open_at: { pl: "2026-10-09T04:00:00+04:00" } })],
    fixtures: [fx("pl", "2026-10-10T14:00:00Z"), fx("pl", "2026-10-09T18:30:00Z")],
    now: NOW,
  });
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].league_open_at.pl, "2026-10-09T22:30:00+04:00");
  assert.deepEqual(plan.updates[0].changes, [
    { number: 1, league: "pl", old: "2026-10-09T04:00:00+04:00", new: "2026-10-09T22:30:00+04:00" },
  ]);
});

test("a league already locked (open time in the past) is untouched", () => {
  const plan = planOpenAtRefresh({
    gameweeks: [
      gw({
        league_open_at: {
          pl: "2026-10-03T22:00:00+04:00",
          laliga: "2026-10-09T04:00:00+04:00",
        },
      }),
    ],
    fixtures: [fx("pl", "2026-10-09T18:30:00Z"), fx("laliga", "2026-10-10T17:00:00Z")],
    now: NOW,
  });
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].league_open_at.pl, "2026-10-03T22:00:00+04:00");
  assert.equal(plan.updates[0].league_open_at.laliga, "2026-10-10T21:00:00+04:00");
  assert.deepEqual(plan.skippedPast, [{ number: 1, league: "pl", old: "2026-10-03T22:00:00+04:00" }]);
});

test("only upcoming gameweeks starting within 14 days are considered", () => {
  const fixtures = [fx("pl", "2026-10-30T14:00:00Z")];
  const far = gw({
    id: "far",
    number: 4,
    window_start: "2026-10-29T20:00:00.000Z",
    window_end: "2026-11-05T19:59:59.000Z",
    league_open_at: { pl: "2026-10-30T04:00:00+04:00" },
  });
  const live = gw({ id: "live", number: 2, state: "live", league_open_at: { pl: "2026-10-09T04:00:00+04:00" } });
  const plan = planOpenAtRefresh({
    gameweeks: [far, live],
    fixtures: [...fixtures, fx("pl", "2026-10-09T18:30:00Z")],
    now: NOW,
  });
  assert.equal(plan.updates.length, 0);
});

test("an unchanged time is not rewritten, and a league with no fixtures keeps its value", () => {
  const plan = planOpenAtRefresh({
    gameweeks: [gw({ league_open_at: { pl: "2026-10-09T22:30:00+04:00", ligue1: "2026-10-10T04:00:00+04:00" } })],
    fixtures: [fx("pl", "2026-10-09T18:30:00Z")],
    now: NOW,
  });
  assert.equal(plan.updates.length, 0);
  assert.equal(plan.unchanged, 1);
  assert.deepEqual(plan.noFixtures, [{ number: 1, league: "ligue1", old: "2026-10-10T04:00:00+04:00" }]);
});

test("a refresh write sets league_open_at only and leaves number and windows out", async () => {
  const plan = planOpenAtRefresh({
    gameweeks: [gw({ league_open_at: { pl: "2026-10-09T04:00:00+04:00" } })],
    fixtures: [fx("pl", "2026-10-09T18:30:00Z")],
    now: NOW,
  });
  const db = makeFakeDb(() => ({ data: null, error: null }));
  const result = await applyOpenAtRefresh(db, plan.updates);
  assert.equal(result.applied, 1);
  const writes = db.log.filter((q) => q.op === "update");
  assert.equal(writes.length, 1);
  assert.deepEqual(Object.keys(writes[0].payload), ["league_open_at"]);
  assert.deepEqual(writes[0].filters, [
    ["eq", "id", "gw1"],
    ["eq", "state", "upcoming"],
  ]);
});

test("the plan never carries number or window changes", () => {
  const plan = planOpenAtRefresh({
    gameweeks: [gw({ league_open_at: { pl: "2026-10-09T04:00:00+04:00" } })],
    fixtures: [fx("pl", "2026-10-09T18:30:00Z")],
    now: NOW,
  });
  for (const u of plan.updates) {
    assert.deepEqual(Object.keys(u).sort(), ["changes", "id", "league_open_at", "number"]);
  }
});
