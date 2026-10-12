import assert from "node:assert/strict";
import test from "node:test";
import {
  fixtureNeedsStatusRefresh,
  fixtureNeedsUnscored,
  mergeScoreQueue,
  prepareAutoSyncBatch,
} from "../../lib/ultima/auto-sync-select.js";

const day = 24 * 60 * 60 * 1000;

test("a not-started fixture is refreshed to full time and queued for scoring in the same run", async () => {
  const now = new Date("2026-10-12T20:00:00Z");
  const kickoff = new Date(now.getTime() - 2 * day).toISOString();
  let scoredStatus = null;
  const result = await prepareAutoSyncBatch({
    fixtures: [{
      id: "fx-old",
      league: "pl",
      status: "NS",
      kickoff_at: kickoff,
      gameweek_id: "gw-old",
      sportmonks_fixture_id: 99,
    }],
    statCounts: new Map(),
    currentGameweekId: "gw-now",
    now,
    fetchStatus: async (fixture) => {
      scoredStatus = fixture.status;
      return { status: "FT", home_score: 2, away_score: 1 };
    },
    savedQueue: [],
  });

  assert.equal(scoredStatus, "NS");
  assert.equal(result.skipScoring, false);
  assert.equal(result.statusRefreshed, 1);
  assert.equal(result.fixtures.get("fx-old").status, "FT");
  assert.equal(result.batch.length, 1);
  assert.equal(result.batch[0].id, "fx-old");
  assert.equal(result.batch[0].status, "FT");
});

test("full time fixtures that already have player rows are not queued", () => {
  assert.equal(fixtureNeedsUnscored({ league: "pl", status: "FT" }, 0), true);
  assert.equal(fixtureNeedsUnscored({ league: "pl", status: "LIVE" }, 0), true);
  assert.equal(fixtureNeedsUnscored({ league: "pl", status: "FT" }, 12), false);
  assert.equal(fixtureNeedsUnscored({ league: "pl", status: "NS" }, 0), false);
});

test("status refresh only includes kickoffs that have passed and are not full time", () => {
  const now = new Date("2026-10-12T20:00:00Z");
  const past = new Date(now.getTime() - day).toISOString();
  const future = new Date(now.getTime() + day).toISOString();
  assert.equal(fixtureNeedsStatusRefresh({ league: "pl", status: "NS", kickoff_at: past }, now), true);
  assert.equal(fixtureNeedsStatusRefresh({ league: "pl", status: null, kickoff_at: past }, now), true);
  assert.equal(fixtureNeedsStatusRefresh({ league: "pl", status: "LIVE", kickoff_at: past }, now), true);
  assert.equal(fixtureNeedsStatusRefresh({ league: "pl", status: "FT", kickoff_at: past }, now), false);
  assert.equal(fixtureNeedsStatusRefresh({ league: "pl", status: "NS", kickoff_at: future }, now), false);
});

test("a refresh that exceeds 4 seconds skips scoring", async () => {
  const now = new Date("2026-10-12T20:00:00Z");
  const kickoff = new Date(now.getTime() - day).toISOString();
  const result = await prepareAutoSyncBatch({
    fixtures: [{ id: "fx", league: "pl", status: "NS", kickoff_at: kickoff, gameweek_id: "gw" }],
    now,
    refreshBudgetMs: -1,
    fetchStatus: async () => ({ status: "FT" }),
  });
  assert.equal(result.skipScoring, true);
  assert.equal(result.batch.length, 0);
});

test("the score queue advances and does not rewind", () => {
  const first = mergeScoreQueue([], ["a", "b", "c", "d"]);
  const next = mergeScoreQueue(first.slice(3), ["d", "e"]);
  assert.deepEqual(next, ["d", "e"]);
});
