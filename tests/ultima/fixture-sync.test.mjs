import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { countByGameweek, gameweekForKickoff, kickoffMs } from "@/lib/ultima/fixture-mapping";
import { makeFakeDb } from "./helpers/fake-db.mjs";

const gw = (number, start, end) => ({ id: `gw${number}`, number, state: "upcoming", window_start: start, window_end: end });
const GWS = [
  gw(1, "2026-10-08T20:00:00.000Z", "2026-10-15T19:59:59.000Z"),
  gw(2, "2026-10-15T20:00:00.000Z", "2026-10-22T19:59:59.000Z"),
];

test("sportmonks kickoffs without a zone are read as UTC", () => {
  assert.equal(kickoffMs("2026-10-09 18:30:00"), Date.parse("2026-10-09T18:30:00Z"));
  assert.equal(kickoffMs("2026-10-09T22:30:00+04:00"), Date.parse("2026-10-09T18:30:00Z"));
});

test("a fixture maps to the gameweek whose window holds its kickoff, at the edges too", () => {
  assert.equal(gameweekForKickoff("2026-10-08 20:00:00", GWS).number, 1);
  assert.equal(gameweekForKickoff("2026-10-15 19:59:59", GWS).number, 1);
  assert.equal(gameweekForKickoff("2026-10-15 20:00:00", GWS).number, 2);
  assert.equal(gameweekForKickoff("2026-10-08 19:59:59", GWS), null);
  assert.equal(gameweekForKickoff("2026-10-23 00:00:00", GWS), null);
});

test("counts are per league per gameweek and ignore fixtures outside the chosen windows", () => {
  const f = (league, kickoff) => ({ league, kickoff });
  const counts = countByGameweek(
    [f("pl", "2026-10-10 14:00:00"), f("pl", "2026-10-11 14:00:00"), f("seriea", "2026-10-17 18:45:00"), f("pl", "2026-11-01 14:00:00")],
    GWS,
  );
  assert.deepEqual(counts[1], { pl: 2, laliga: 0, seriea: 0, bundesliga: 0, ligue1: 0, total: 2 });
  assert.deepEqual(counts[2], { pl: 0, laliga: 0, seriea: 1, bundesliga: 0, ligue1: 0, total: 1 });
});

const world = { fixtures: [], fetchError: null };
const db = makeFakeDb((q) => {
  if (q.table === "ultima_gameweeks") return { data: GWS, error: null };
  return { data: null, error: null };
});
mock.module("@/lib/ultima/provider/index", {
  namedExports: {
    getStatsProvider: () => ({
      fetchFixtures: async (league) => {
        if (world.fetchError === league) throw new Error("boom");
        return world.fixtures.filter((x) => x.league === league);
      },
    }),
  },
});
mock.module("@/lib/ultima/server/db", { namedExports: { getUltimaDb: () => db } });
const { runFixtureSync } = await import("@/lib/ultima/server/fixture-sync");

const fx = (league, kickoff, id) => ({ league, provider_id: `sm-fix-${id}`, kickoff, kickoff_at: kickoff, status: "NS" });

test("dry run counts and writes nothing", async () => {
  world.fetchError = null;
  world.fixtures = [fx("pl", "2026-10-10 14:00:00", 1), fx("laliga", "2026-10-16 18:00:00", 2)];
  db.log.length = 0;
  const report = await runFixtureSync({ db, competitionId: "c", numbers: [1, 2], apply: false });
  assert.equal(report.counts[1].pl, 1);
  assert.equal(report.counts[2].laliga, 1);
  assert.equal(db.log.filter((q) => q.op === "upsert").length, 0);
});

test("apply writes only in-window fixtures, each tagged with its gameweek", async () => {
  world.fixtures = [
    fx("pl", "2026-10-10 14:00:00", 1),
    fx("laliga", "2026-10-16 18:00:00", 2),
    fx("pl", "2026-10-30 14:00:00", 3),
  ];
  db.log.length = 0;
  const report = await runFixtureSync({ db, competitionId: "c", numbers: [1, 2], apply: true });
  const writes = db.log.filter((q) => q.op === "upsert");
  assert.equal(report.written, 2);
  assert.deepEqual(writes.map((q) => q.payload.gameweek_id).sort(), ["gw1", "gw2"]);
});

test("apply refuses to write when a league could not be read", async () => {
  world.fetchError = "seriea";
  world.fixtures = [fx("pl", "2026-10-10 14:00:00", 1)];
  db.log.length = 0;
  const report = await runFixtureSync({ db, competitionId: "c", numbers: [1], apply: true });
  assert.equal(report.written, 0);
  assert.equal(db.log.filter((q) => q.op === "upsert").length, 0);
  assert.match(report.errors[0], /seriea/);
});

const { compareExpected } = await import("@/lib/ultima/server/fixture-sync");
const ONE = { pl: 1, laliga: 0, seriea: 0, bundesliga: 0, ligue1: 0 };

test("compareExpected lists every league that differs and any gameweek without a table", () => {
  const counts = { 1: { pl: 2, laliga: 0, seriea: 0, bundesliga: 0, ligue1: 0 } };
  assert.deepEqual(compareExpected(counts, { 1: ONE }, [1]), [{ gameweek: 1, league: "pl", expected: 1, actual: 2 }]);
  assert.equal(compareExpected(counts, { 1: ONE }, [1, 2]).length, 2);
});

test("guarded apply writes nothing when counts differ from expected", async () => {
  world.fetchError = null;
  world.fixtures = [fx("pl", "2026-10-10 14:00:00", 1), fx("pl", "2026-10-11 14:00:00", 2)];
  db.log.length = 0;
  const report = await runFixtureSync({ db, competitionId: "c", numbers: [1], apply: true, expected: { 1: ONE } });
  assert.equal(report.guard, "mismatch");
  assert.equal(report.written, 0);
  assert.equal(db.log.filter((q) => q.op === "upsert").length, 0);
});

test("guarded apply writes when counts equal expected", async () => {
  world.fixtures = [fx("pl", "2026-10-10 14:00:00", 1)];
  db.log.length = 0;
  const report = await runFixtureSync({ db, competitionId: "c", numbers: [1], apply: true, expected: { 1: ONE } });
  assert.equal(report.guard, "match");
  assert.equal(report.written, 1);
});
