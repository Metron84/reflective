import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { readFileSync } from "node:fs";
import { has, makeFakeDb } from "./helpers/fake-db.mjs";
import { buildMatchday, groupFixtures, rankManagers } from "../../lib/ultima/matchday.js";

const LEAGUES = ["pl", "laliga", "seriea", "bundesliga", "ligue1"];
const NOW = Date.parse("2026-10-10T16:00:00Z");

const players = new Map();
const lineups = [];
let slot = 0;
for (const league of LEAGUES) {
  for (let i = 1; i <= 3; i += 1) {
    slot += 1;
    const id = `${league}${i}`;
    players.set(id, { id, name: `${league}-${i}`, club: "C", league, draft_round: 1, bolt_eligible: false });
    lineups.push({ manager_id: "m1", slot, slot_group: league, player_id: id, is_captain: false });
    lineups.push({ manager_id: "m2", slot, slot_group: league, player_id: id, is_captain: false });
  }
}
const mine = (cap) => lineups.map((r) => (r.manager_id === "m1" ? { ...r, is_captain: cap.includes(r.player_id) } : r));

const gw = {
  id: "g1",
  number: 3,
  state: "live",
  league_open_at: { pl: "2026-10-10T14:00:00Z", laliga: "2026-10-10T20:00:00Z" },
};
const managers = [
  { id: "m1", team_name: "Alpha", colour: "navy" },
  { id: "m2", team_name: "Beta", colour: "teal" },
];
const stats = [
  { player_id: "pl1", goals: 2, assists: 0, rating: 7.6 }, // 6 + 2 = 8
  { player_id: "pl2", goals: 0, assists: 1, rating: 6.0 }, // 1
  { player_id: "laliga1", goals: 1, assists: 0, rating: 7.6 }, // 5
];

function build(extra = {}) {
  return buildMatchday({
    gameweek: gw,
    fixtures: [],
    managers,
    lineups: mine(["pl1"]),
    playersById: players,
    stats,
    viewerManagerId: "m1",
    now: NOW,
    ...extra,
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

test("a league with no fixtures still appears, empty, and the page says so", () => {
  const groups = groupFixtures([
    { id: "f1", league: "pl", kickoff: "2026-10-10T14:00:00Z", status: "LIVE", home_club: "A", away_club: "B", home_score: 1, away_score: 0 },
  ]);
  assert.deepEqual(groups.map((g) => g.league), LEAGUES);
  assert.equal(groups[0].fixtures.length, 1);
  assert.ok(groups.slice(1).every((g) => g.fixtures.length === 0));
});

test("fixtures show kickoff in Dubai time, live score and status", () => {
  const [pl] = groupFixtures([
    { id: "f1", league: "pl", kickoff: "2026-10-10T14:00:00Z", status: "LIVE", home_club: "A", away_club: "B", home_score: 1, away_score: 0 },
    { id: "f2", league: "pl", kickoff: "2026-10-10T16:30:00Z", status: "NS", home_club: "C", away_club: "D", home_score: null, away_score: null },
    { id: "f3", league: "pl", kickoff: "2026-10-09T14:00:00Z", status: "FT", home_club: "E", away_club: "F", home_score: 2, away_score: 2 },
  ]);
  assert.deepEqual(pl.fixtures.map((f) => f.id), ["f3", "f1", "f2"]); // by kickoff
  const live = pl.fixtures.find((f) => f.id === "f1");
  assert.equal(live.kickoff, "Sat 10 Oct, 18:00"); // 14:00Z is 18:00 in Dubai
  assert.equal(live.score, "1 - 0");
  assert.equal(live.statusLabel, "LIVE");
  assert.equal(live.live, true);
  const upcoming = pl.fixtures.find((f) => f.id === "f2");
  assert.equal(upcoming.score, null);
  assert.equal(upcoming.statusLabel, "");
  assert.equal(pl.fixtures.find((f) => f.id === "f3").statusLabel, "FT");
});

test("a provider status we do not know reads as not started, never as live", () => {
  const [pl] = groupFixtures([
    { id: "f1", league: "pl", kickoff: "2026-10-10T14:00:00Z", status: "weird", home_club: "A", away_club: "B", home_score: 3, away_score: 3 },
  ]);
  assert.equal(pl.fixtures[0].live, false);
  assert.equal(pl.fixtures[0].score, null); // not started: no score shown
});

// ---------------------------------------------------------------------------
// My XV and totals
// ---------------------------------------------------------------------------

test("captain points are doubled, marked C, and the total adds up", () => {
  const view = build();
  const pl = view.you.xv.countries.find((c) => c.league === "pl");
  const pl1 = pl.rows.find((r) => r.playerId === "pl1");
  assert.equal(pl1.captain, true);
  assert.equal(pl1.raw, 8);
  assert.equal(pl1.points, 16);
  assert.equal(pl.rows.find((r) => r.playerId === "pl2").points, 1);
  // 16 + 1 + laliga1 5 = 22
  assert.equal(view.you.total, 22);
  assert.equal(view.you.xv.captainCount, 1);
});

test("two captains flagged in one country double only one", () => {
  const view = build({ lineups: mine(["pl1", "pl2"]) });
  assert.equal(view.you.xv.countries[0].rows.filter((r) => r.captain).length, 1);
  assert.equal(view.you.total, 22);
});

test("a captain who left the XV leaves no double and no stale C", () => {
  const benched = mine(["pl1"]).map((r) =>
    r.manager_id === "m1" && r.player_id === "pl1" ? { ...r, player_id: null, is_captain: false } : r,
  );
  const view = build({ lineups: benched });
  assert.equal(view.you.xv.captainCount, 0);
  assert.equal(view.you.total, 1 + 5);
});

test("last week's captain carries into the matchday while he is still in the XV", () => {
  const view = build({ lineups: mine([]), prevCaptains: { m1: { pl: "pl1" } } });
  assert.equal(view.you.xv.captains.pl, "pl1");
  assert.equal(view.you.total, 22);
});

test("an empty gameweek: no XV rows, zero points, no crash", () => {
  const view = build({ lineups: [], stats: [] });
  assert.equal(view.you.total, 0);
  assert.equal(view.you.xv.filledCount, 0);
  assert.equal(view.anyFixtures, false);
  assert.equal(view.managers.length, 2);
});

test("no current gameweek is reported, not thrown", () => {
  assert.deepEqual(buildMatchday({ gameweek: null }), { noGameweek: true });
});

// ---------------------------------------------------------------------------
// All managers
// ---------------------------------------------------------------------------

test("other managers' XV stays hidden for a country until its matchday opens", () => {
  const view = build();
  const other = view.managers.find((m) => m.id === "m2");
  const byLeague = Object.fromEntries(other.xv.countries.map((c) => [c.league, c]));
  assert.equal(byLeague.pl.visible, true); // opened 14:00Z, now 16:00Z
  assert.equal(byLeague.laliga.visible, false); // opens 20:00Z
  assert.equal(byLeague.laliga.rows.length, 0);
  assert.equal(byLeague.laliga.hiddenCount, 3);
  // your own XV is always visible
  assert.ok(view.you.xv.countries.every((c) => c.visible));
});

test("a final gameweek shows every XV; a country with no open time in a live week counts as open", () => {
  const final = build({ gameweek: { ...gw, state: "final" } });
  assert.ok(final.managers.find((m) => m.id === "m2").xv.countries.every((c) => c.visible));
  const noTimes = build({ gameweek: { ...gw, league_open_at: {} } });
  assert.ok(noTimes.managers.find((m) => m.id === "m2").xv.countries.every((c) => c.visible));
});

test("managers rank by gameweek points, equal points share a rank", () => {
  const ranked = rankManagers([
    { id: "a", name: "A", total: 10 },
    { id: "b", name: "B", total: 20 },
    { id: "c", name: "C", total: 10 },
  ]);
  assert.deepEqual(ranked.map((r) => [r.id, r.rank]), [["b", 1], ["a", 2], ["c", 2]]);
  const view = build();
  assert.equal(view.managers[0].id, "m1"); // 22 vs 20? m2 has no captain: 8+1+5 = 14
  assert.equal(view.managers[0].rank, 1);
  assert.equal(view.managers[1].total, 14);
});

test("polling is on only while a match is on or started and unfinished", () => {
  const f = (status, kickoff) => ({ id: status + kickoff, league: "pl", kickoff, status, home_club: "A", away_club: "B" });
  assert.equal(build({ fixtures: [f("LIVE", "2026-10-10T15:00:00Z")] }).pollable, true);
  assert.equal(build({ fixtures: [f("NS", "2026-10-10T15:00:00Z")] }).pollable, true); // kicked off, status not moved
  assert.equal(build({ fixtures: [f("NS", "2026-10-11T15:00:00Z")] }).pollable, false);
  assert.equal(build({ fixtures: [f("FT", "2026-10-10T12:00:00Z")] }).pollable, false);
  assert.equal(build({ fixtures: [] }).pollable, false);
});

// ---------------------------------------------------------------------------
// Rail order
// ---------------------------------------------------------------------------

test("rail order: Hub, Draft, Squad, Matchday, Table, Market, Trades, Practice, then the rest, Admin last", () => {
  const src = readFileSync(new URL("../../components/ultima/UltimaShell.js", import.meta.url), "utf8");
  const block = src.slice(src.indexOf("const OFFICE_NAV"), src.indexOf("];", src.indexOf("const OFFICE_NAV")));
  const labels = [...block.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(labels.slice(0, 8), ["Hub", "Draft", "Squad", "Matchday", "Table", "Market", "Trades", "Practice"]);
  assert.match(src, /\.\.\.OFFICE_NAV,\s*\.\.\.\(isCommissioner\s*\?\s*\[\{ href: "\/ultima\/admin"/);
});

// ---------------------------------------------------------------------------
// Live refresh: at most once every 2 minutes, only when something is on
// ---------------------------------------------------------------------------

const live = {
  syncRow: { id: "matchday-live", last_ok_at: null },
  fixtures: [],
  providerCalls: 0,
  statCalls: 0,
  swapWins: true,
};
const liveDb = makeFakeDb((q) => {
  if (q.table === "ultima_europe_sync") {
    if (q.op === "select") return { data: live.syncRow, error: null };
    if (q.op === "insert") return { data: null, error: live.syncRow ? { message: "dup" } : null };
    if (q.op === "update") {
      if (q.payload.last_ok_at) return { data: live.swapWins ? [{ id: "matchday-live" }] : [], error: null };
      return { data: null, error: null };
    }
  }
  if (q.table === "ultima_fixtures") {
    if (q.op === "upsert") return { data: null, error: null };
    return { data: live.fixtures, error: null };
  }
  return { data: [], error: null };
});
mock.module("@/lib/ultima/server/db", { namedExports: { getUltimaDb: () => liveDb } });
mock.module("@/lib/ultima/provider/index", {
  namedExports: {
    getStatsProvider: () => ({
      fetchFixtures: async (league) => {
        live.providerCalls += 1;
        return live.fixtures.filter((f) => f.league === league);
      },
    }),
  },
});
mock.module("@/lib/ultima/server/scoring-run", { namedExports: { recomputeGameweekScores: async () => ({ ok: true }) } });
mock.module("@/lib/ultima/server/sync", {
  namedExports: {
    advanceGameweekState: async () => ({ ok: true }),
    syncStatsForFixtures: async () => {
      live.statCalls += 1;
      return { ok: true };
    },
    upsertFixturePacks: async (_db, packs) => ({ ok: true, synced: packs.length, errors: [] }),
  },
});
const { claimRefresh, isFresh, liveCandidates, refreshMatchdayLive, LIVE_REFRESH_MS } = await import(
  "../../lib/ultima/server/live-refresh.js"
);

const fixture = (status, kickoff, league = "pl") => ({
  id: `${league}-${status}-${kickoff}`,
  provider_id: `sm-fix-${league}-${status}-${kickoff}`,
  league,
  kickoff,
  status,
});

test("candidates: live, and kicked off in the last 5 hours; not future, old, postponed", () => {
  const c = liveCandidates(
    [
      fixture("LIVE", "2026-10-10T15:00:00Z"),
      fixture("NS", "2026-10-10T15:30:00Z"),
      fixture("FT", "2026-10-10T12:00:00Z"),
      fixture("NS", "2026-10-10T20:00:00Z"),
      fixture("FT", "2026-10-09T12:00:00Z"),
      fixture("POSTP", "2026-10-10T15:00:00Z"),
    ],
    NOW,
  );
  assert.equal(c.length, 3);
});

test("fresh means refreshed less than two minutes ago", () => {
  assert.equal(LIVE_REFRESH_MS, 120_000);
  assert.equal(isFresh(new Date(NOW - 119_000).toISOString(), NOW), true);
  assert.equal(isFresh(new Date(NOW - 121_000).toISOString(), NOW), false);
  assert.equal(isFresh(null, NOW), false);
});

test("claim: a fresh reading blocks, a stale one is taken once", async () => {
  live.syncRow = { id: "matchday-live", last_ok_at: new Date(NOW - 30_000).toISOString() };
  assert.equal(await claimRefresh(liveDb, NOW), false);
  live.syncRow = { id: "matchday-live", last_ok_at: new Date(NOW - 300_000).toISOString() };
  live.swapWins = true;
  assert.equal(await claimRefresh(liveDb, NOW), true);
  live.swapWins = false; // another instance changed the stamp first
  assert.equal(await claimRefresh(liveDb, NOW), false);
});

test("nothing is fetched when no match is on", async () => {
  live.syncRow = { id: "matchday-live", last_ok_at: null };
  live.fixtures = [fixture("NS", "2026-10-11T15:00:00Z")];
  live.providerCalls = 0;
  const res = await refreshMatchdayLive({ competitionId: "c", gameweek: { id: "g1" }, now: NOW });
  assert.equal(res.skipped, "idle");
  assert.equal(live.providerCalls, 0);
});

test("a recent refresh is reused: no provider calls", async () => {
  live.syncRow = { id: "matchday-live", last_ok_at: new Date(NOW - 20_000).toISOString() };
  live.fixtures = [fixture("LIVE", "2026-10-10T15:00:00Z")];
  live.providerCalls = 0;
  const res = await refreshMatchdayLive({ competitionId: "c", gameweek: { id: "g1" }, now: NOW });
  assert.equal(res.skipped, "fresh");
  assert.equal(live.providerCalls, 0);
});

test("a due refresh asks only the leagues with a match on, and reads stats once", async () => {
  live.syncRow = { id: "matchday-live", last_ok_at: new Date(NOW - 600_000).toISOString() };
  live.swapWins = true;
  live.fixtures = [fixture("LIVE", "2026-10-10T15:00:00Z", "pl"), fixture("FT", "2026-10-10T12:00:00Z", "pl")];
  live.providerCalls = 0;
  live.statCalls = 0;
  const res = await refreshMatchdayLive({ competitionId: "c", gameweek: { id: "g1" }, now: NOW });
  assert.equal(res.ok, true);
  assert.equal(live.providerCalls, 1); // pl only, not all five leagues
  assert.equal(live.statCalls, 1);
});

test("ten people opening Matchday at once cause one upstream refresh", async () => {
  live.syncRow = { id: "matchday-live", last_ok_at: new Date(NOW - 600_000).toISOString() };
  live.swapWins = true;
  live.fixtures = [fixture("LIVE", "2026-10-10T15:00:00Z", "pl")];
  live.providerCalls = 0;
  live.statCalls = 0;
  await Promise.all(
    Array.from({ length: 10 }, () => refreshMatchdayLive({ competitionId: "c", gameweek: { id: "g1" }, now: NOW })),
  );
  assert.equal(live.providerCalls, 1);
  assert.equal(live.statCalls, 1);
});
