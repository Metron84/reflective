import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { makeFakeDb } from "./helpers/fake-db.mjs";
import { firstXvByDraftOrder, shortLeagues } from "../../lib/ultima/lineup/auto-start.js";

const LEAGUES = ["pl", "laliga", "seriea", "bundesliga", "ligue1"];
const FILL = 1500; // more than one 1000-row page of stat rows

const lineup = LEAGUES.flatMap((league, l) =>
  [1, 2, 3].map((n) => ({
    manager_id: "m1",
    slot: l * 3 + n,
    slot_group: league,
    player_id: `${league}${n}`,
    is_captain: n === 1,
  })),
);
const players = LEAGUES.flatMap((league, l) =>
  [1, 2, 3].map((n) => ({
    id: `${league}${n}`,
    league,
    draft_round: 1,
    provider_id: `sm-${league}-${l * 10 + n}`,
  })),
);

// 1500 filler rows with ids that sort first, then the rows that matter.
const stats = [
  ...Array.from({ length: FILL }, (_, i) => ({
    id: `a${String(i).padStart(5, "0")}`, fixture_id: "f1", player_id: `other${i}`, goals: 0, assists: 0, rating: 6,
  })),
  { id: "z1", fixture_id: "f1", player_id: "pl1", goals: 2, assists: 0, rating: 8.19 }, // 6 + 2 = 8, captain
  { id: "z2", fixture_id: "f1", player_id: "pl2", goals: 0, assists: 0, rating: 6.1 }, // played, 0
  { id: "z3", fixture_id: "f1", player_id: "laliga1", goals: 1, assists: 0, rating: 7.53 }, // 3 + 2 = 5, captain
  { id: "z4", fixture_id: "f1", player_id: null, sportmonks_player_id: 21, goals: 1, rating: 7 }, // seriea1 not linked
];

function page(rows, q) {
  const inFilter = q.filters.find((f) => f[0] === "in" && f[1] === "fixture_id");
  let out = inFilter ? rows.filter((r) => inFilter[2].includes(r.fixture_id)) : rows;
  const range = q.filters.find((f) => f[0] === "range");
  // Supabase returns at most 1000 rows to a read without a range.
  out = range ? out.slice(range[1], range[2] + 1) : out.slice(0, 1000);
  return out;
}

const db = makeFakeDb((q) => {
  switch (q.table) {
    case "ultima_gameweeks":
      return { data: { id: "gw1", number: 1, competition_id: "c", state: "final" }, error: null };
    case "ultima_competition":
      return { data: { rating_thresholds: {} }, error: null };
    case "ultima_managers":
      return { data: [{ id: "m1", team_name: "TRF" }], error: null };
    case "ultima_fixtures":
      return { data: [{ id: "f1", status: "FT" }], error: null };
    case "ultima_player_match_stats":
      return { data: page(stats, q), error: null };
    case "ultima_players": {
      const ids = q.filters.find((f) => f[0] === "in" && f[1] === "id")?.[2] ?? [];
      return { data: players.filter((p) => ids.includes(p.id)), error: null };
    }
    case "ultima_lineups":
      if (q.op !== "select") return { data: null, error: null };
      return { data: lineup, error: null };
    case "ultima_rosters":
      return { data: [], error: null };
    default:
      return { data: [], error: null };
  }
});
mock.module("@/lib/ultima/server/db", { namedExports: { getUltimaDb: () => db } });
mock.module("@/lib/ultima/server/record-event", { namedExports: { recordUltimaEvent: async () => {} } });
const { recomputeGameweekScores } = await import("../../lib/ultima/server/scoring-run.js");

test("a gameweek with more than 1000 stat rows still scores every player", async () => {
  const result = await recomputeGameweekScores("c", "gw1");
  const [m] = result.scores;
  // pl1 8 + laliga1 5 = 13 base; both captains, so the bonus is another 13
  assert.equal(m.base_points, 13);
  assert.equal(m.captain_bonus, 13);
  assert.equal(m.points, 26);
});

test("a captain adds a bonus on top and never zeroes the player", async () => {
  const result = await recomputeGameweekScores("c", "gw1");
  const rows = result.scores[0].players;
  const pedro = rows.find((r) => r.player_id === "pl1");
  assert.equal(pedro.captain, true);
  assert.equal(pedro.base_points, 8);
  assert.equal(pedro.captain_bonus, 8);
  assert.equal(pedro.zero_reason, null);
});

test("breakdown names why a player scores 0", async () => {
  const result = await recomputeGameweekScores("c", "gw1");
  const rows = result.scores[0].players;
  assert.equal(rows.find((r) => r.player_id === "pl2").zero_reason, "played_no_points");
  assert.equal(rows.find((r) => r.player_id === "pl3").zero_reason, "no_stats");
  assert.equal(rows.find((r) => r.player_id === "seriea1").zero_reason, "unlinked_stats");
});

const rosterPlayer = (id, league, round, extra = {}) => ({ id, league, draft_round: round, ...extra });
const fullRoster = LEAGUES.flatMap((league, l) =>
  [1, 2, 3].map((n) => rosterPlayer(`${league}${n}`, league, l * 3 + n)),
);

test("auto-start always gives 15 rows, 3 per league, when the roster can", () => {
  const xv = firstXvByDraftOrder(fullRoster);
  assert.equal(xv.filter((r) => r.player_id).length, 15);
  for (const league of LEAGUES) assert.equal(xv.filter((r) => r.slot_group === league && r.player_id).length, 3);
  assert.deepEqual(shortLeagues(xv), []);
});

test("auto-start fills a league from an unavailable player rather than leaving a slot empty", () => {
  const roster = fullRoster.map((p) => (p.id === "bundesliga3" ? { ...p, inactive_flag: true } : p));
  roster.push(rosterPlayer("bundesliga4", "bundesliga", 40));
  // three startable already: the inactive one stays out
  assert.equal(firstXvByDraftOrder(roster).some((r) => r.player_id === "bundesliga3"), false);
  const thin = fullRoster.map((p) => (p.id === "bundesliga3" ? { ...p, inactive_flag: true } : p));
  const xv = firstXvByDraftOrder(thin);
  assert.equal(xv.filter((r) => r.slot_group === "bundesliga" && r.player_id).length, 3);
  assert.equal(xv.filter((r) => r.player_id).length, 15);
});

test("a roster with only two players in a league cannot make 15, and says which league", () => {
  const roster = fullRoster.filter((p) => p.id !== "bundesliga3");
  const xv = firstXvByDraftOrder(roster);
  assert.equal(xv.filter((r) => r.player_id).length, 14);
  assert.deepEqual(shortLeagues(xv), ["bundesliga"]);
});
