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

const world = { fixtures: [], fetchError: null, gws: GWS };
const db = makeFakeDb((q) => {
  if (q.table === "ultima_gameweeks" && q.op === "select") return { data: world.gws, error: null };
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
  assert.deepEqual(writes.flatMap((q) => q.payload.map((r) => r.gameweek_id)).sort(), ["gw1", "gw2"]);
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

// ---- season scope: all five leagues, every gameweek to GW32, batched, league_open_at ----
const { upsertFixturePacks, FIXTURE_BATCH_SIZE } = await import("@/lib/ultima/server/sync");
const { seasonCandidates } = await import("@/lib/ultima/server/fixture-sync");

const NOW = new Date("2026-10-05T03:00:00Z");
const DAY = 24 * 3600 * 1000;
const FRI = Date.parse("2026-10-08T20:00:00Z"); // Fri 00:00 Dubai
const season = (extra = {}) =>
  Array.from({ length: 32 }, (_, i) => ({
    id: `s${i + 1}`,
    number: i + 1,
    state: "upcoming",
    window_start: new Date(FRI + i * 7 * DAY).toISOString(),
    window_end: new Date(FRI + (i + 1) * 7 * DAY - 1000).toISOString(),
    league_open_at: {},
    ...(extra[i + 1] ?? {}),
  }));
const kick = (week, dayOffset, hourUtc = 15) => new Date(FRI + (week - 1) * 7 * DAY + dayOffset * DAY + (hourUtc - 20) * 3600 * 1000).toISOString();
const sfx = (league, week, n, dayOffset = 1) => fx(league, kick(week, dayOffset), `${league}-${week}-${n}`);
const everyLeague = (weeks, skip = () => false) =>
  ["pl", "laliga", "seriea", "bundesliga", "ligue1"].flatMap((l) =>
    weeks.flatMap((w) => (skip(l, w) ? [] : [sfx(l, w, 1), sfx(l, w, 2, 2)])),
  );
const upserts = () => db.log.filter((q) => q.op === "upsert");
const gwUpdates = () => db.log.filter((q) => q.op === "update" && q.table === "ultima_gameweeks");

test("season scope covers every gameweek not yet ended, to GW32", () => {
  const gws = season();
  gws[0].window_end = "2026-10-01T00:00:00.000Z"; // already ended
  assert.equal(seasonCandidates(gws, NOW).length, 31);
  assert.equal(seasonCandidates(gws, NOW).at(-1).number, 32);
});

test("season apply tags all 32 gameweeks and writes in batches of 200", async () => {
  world.fetchError = null;
  world.gws = season();
  world.fixtures = everyLeague([...Array(32).keys()].map((i) => i + 1)); // 5 leagues x 32 weeks x 2 = 320
  db.log.length = 0;
  const report = await runFixtureSync({ db, competitionId: "c", scope: "season", apply: true, now: NOW });
  assert.deepEqual(report.errors, []);
  assert.equal(report.gameweeks.length, 32);
  assert.equal(report.written, 320);
  const sizes = upserts().map((q) => q.payload.length);
  assert.ok(sizes.every((n) => n <= FIXTURE_BATCH_SIZE));
  assert.deepEqual(sizes, [200, 120]);
  const rows = upserts().flatMap((q) => q.payload);
  assert.equal(new Set(rows.map((r) => r.gameweek_id)).size, 32);
  assert.ok(rows.every((r) => r.gameweek_id));
  assert.ok(upserts().every((q) => q.options.onConflict === "provider_id"));
});

test("season apply sets league_open_at from the first real kickoff and leaves a locked league alone", async () => {
  world.gws = season({
    1: { league_open_at: { pl: "2026-10-09T04:00:00+04:00", laliga: "2026-10-04T04:00:00+04:00" } },
  });
  world.fixtures = everyLeague([1]).map((f) => f);
  world.fixtures.push(fx("pl", "2026-10-09 14:00:00", "early")); // earliest PL kickoff, Fri 18:00 Dubai
  db.log.length = 0;
  const report = await runFixtureSync({ db, competitionId: "c", scope: "season", apply: true, now: NOW });
  const gw1 = gwUpdates().find((q) => q.filters.some((f) => f[1] === "id" && f[2] === "s1"));
  assert.equal(gw1.payload.league_open_at.pl, "2026-10-09T18:00:00+04:00");
  assert.equal(gw1.payload.league_open_at.laliga, "2026-10-04T04:00:00+04:00"); // locked, untouched
  assert.equal(report.openAt.applied >= 1, true);
  assert.ok(gw1.filters.some((f) => f[1] === "state" && f[2] === "upcoming"));
});

test("a league with no fixtures in a gameweek is skipped, not estimated", async () => {
  world.gws = season({ 2: { league_open_at: { laliga: "2026-10-16T04:00:00+04:00" } } });
  world.fixtures = everyLeague([1, 2, 3], (l, w) => l === "laliga" && w === 2); // international break for ESP
  db.log.length = 0;
  const report = await runFixtureSync({ db, competitionId: "c", scope: "season", apply: true, now: NOW });
  assert.equal(report.counts[2].laliga, 0);
  assert.ok(report.openAt.noFixtures.some((n) => n.number === 2 && n.league === "laliga"));
  const gw2 = gwUpdates().find((q) => q.filters.some((f) => f[1] === "id" && f[2] === "s2"));
  assert.equal(gw2.payload.league_open_at.laliga, "2026-10-16T04:00:00+04:00"); // kept as it was
  assert.equal(gw2.payload.league_open_at.pl != null, true);
  assert.equal(report.errors.length, 0);
});

test("an empty gameweek writes nothing for it and sets no open times", async () => {
  world.gws = season();
  world.fixtures = everyLeague([1, 3]); // GW2 has nothing in any league
  db.log.length = 0;
  const report = await runFixtureSync({ db, competitionId: "c", scope: "season", apply: true, now: NOW });
  assert.equal(report.counts[2].total, 0);
  assert.equal(report.errors.length, 0);
  assert.equal(upserts().flatMap((q) => q.payload).filter((r) => r.gameweek_id === "s2").length, 0);
  assert.equal(gwUpdates().some((q) => q.filters.some((f) => f[1] === "id" && f[2] === "s2")), false);
});

test("a league with 0 fixtures inside 72 hours of opening is warned about", async () => {
  world.gws = season(); // GW1 opens 8 Oct 20:00Z, 65 hours after 6 Oct 03:00Z
  world.fixtures = everyLeague([1], (l) => l === "ligue1");
  db.log.length = 0;
  const warn = mock.method(console, "error", () => {});
  const report = await runFixtureSync({ db, competitionId: "c", scope: "season", apply: false, now: new Date("2026-10-06T03:00:00Z") });
  warn.mock.restore();
  assert.ok(report.warnings.some((w) => w.startsWith("GW1 ligue1")));
  assert.equal(report.warnings.some((w) => w.startsWith("GW2 ")), false); // too far out
});

test("a league that returns nothing for the whole season blocks the write", async () => {
  world.gws = season();
  world.fixtures = everyLeague([1, 2], (l) => l === "bundesliga");
  db.log.length = 0;
  const report = await runFixtureSync({ db, competitionId: "c", scope: "season", apply: true, now: NOW });
  assert.match(report.errors[0], /bundesliga: no fixtures returned/);
  assert.equal(upserts().length, 0);
  assert.equal(gwUpdates().length, 0);
});

test("a league that fails to read blocks fixture and open-time writes", async () => {
  world.gws = season();
  world.fetchError = "seriea";
  world.fixtures = everyLeague([1, 2]);
  db.log.length = 0;
  const report = await runFixtureSync({ db, competitionId: "c", scope: "season", apply: true, now: NOW });
  assert.match(report.errors[0], /seriea/);
  assert.equal(upserts().length, 0);
  assert.equal(gwUpdates().length, 0);
  assert.equal(report.openAt.changes.some((c) => c.league === "seriea"), false);
  world.fetchError = null;
});

test("season dry run writes nothing but reports the open-time changes", async () => {
  world.gws = season();
  world.fixtures = everyLeague([1]);
  db.log.length = 0;
  const report = await runFixtureSync({ db, competitionId: "c", scope: "season", apply: false, now: NOW });
  assert.equal(upserts().length, 0);
  assert.equal(gwUpdates().length, 0);
  assert.ok(report.openAt.changes.length >= 5);
});

test("a fixture with no owning gameweek is written without gameweek_id so an old tag survives", async () => {
  const inWin = { league: "pl", fixtures: [fx("pl", "2026-10-10 14:00:00", "a"), fx("pl", "2026-12-25 14:00:00", "b")], error: null };
  db.log.length = 0;
  const result = await upsertFixturePacks(db, [inWin], GWS);
  assert.equal(result.synced, 2);
  const [tagged, untagged] = upserts().map((q) => q.payload);
  assert.equal(tagged[0].gameweek_id, "gw1");
  assert.equal("gameweek_id" in untagged[0], false);
});

test("duplicate provider ids in one run are written once", async () => {
  const pack = { league: "pl", fixtures: [fx("pl", "2026-10-10 14:00:00", "a"), fx("pl", "2026-10-10 14:00:00", "a")], error: null };
  db.log.length = 0;
  const result = await upsertFixturePacks(db, [pack], GWS);
  assert.equal(result.synced, 1);
});

test("a failed batch is reported and the rest still write", async () => {
  const failing = makeFakeDb((q) => (q.op === "upsert" && q.payload[0].provider_id === "sm-fix-first" ? { data: null, error: { message: "bad" } } : { data: null, error: null }));
  const many = [
    fx("pl", "2026-10-10 14:00:00", "first"),
    ...Array.from({ length: FIXTURE_BATCH_SIZE }, (_, i) => fx("pl", "2026-10-10 14:00:00", `n${i}`)),
  ];
  const result = await upsertFixturePacks(failing, [{ league: "pl", fixtures: many, error: null }], GWS);
  assert.equal(result.ok, false);
  assert.equal(result.synced, 1);
  assert.match(result.errors[0], /batch 1: bad/);
});
