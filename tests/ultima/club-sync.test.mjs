import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bareSportmonksId,
  diffClubSync,
  floorMoveNotice,
  pendingLeaguePatches,
  reconcileOwnedDepartures,
  splitMovePreview,
} from "../../lib/ultima/club-sync.js";
import { isGstFriday } from "../../lib/ultima/gst.js";
import { resolveLoanMeta } from "../../lib/ultima/loan.js";
import { floorMessage, floorShortfall } from "../../lib/ultima/trades/rules.js";

const stored = (sm, club, league, extra = {}) => ({
  id: `uuid-${sm}`,
  provider_id: `sm-${league}-${sm}`,
  name: `Player ${sm}`,
  club,
  league,
  active: true,
  inactive_flag: false,
  on_loan: false,
  parent_club: null,
  seed_metrics: { sportmonks_player_id: sm },
  ...extra,
});

const fresh = (sm, club, league, extra = {}) => ({
  provider_id: `sm-${league}-${sm}`,
  name: `Player ${sm}`,
  club,
  league,
  active: true,
  on_loan: false,
  parent_club: null,
  sportmonks_player_id: sm,
  goals_rate: 0.2,
  assists_rate: 0.1,
  rating_avg: 6.8,
  ...extra,
});

const loanTransfer = (overrides = {}) => ({
  type_id: 218,
  date: "2026-08-15",
  fromTeam: { name: "Chelsea" },
  ...overrides,
});

test("bare id: from seed_metrics and from provider_id", () => {
  assert.equal(bareSportmonksId(stored(29709995, "Chelsea", "pl")), 29709995);
  assert.equal(bareSportmonksId({ provider_id: "sm-laliga-99" }), 99);
});

test("loan meta: permanent / old / missing parent never mark on_loan", () => {
  assert.deepEqual(resolveLoanMeta(null, "Arsenal"), { on_loan: false, parent_club: null });
  assert.deepEqual(
    resolveLoanMeta({ type_id: 219, date: "2026-08-01", fromTeam: { name: "Real Sociedad" } }, "Arsenal"),
    { on_loan: false, parent_club: null },
  );
  assert.deepEqual(
    resolveLoanMeta(loanTransfer({ date: "2025-08-01" }), "Brighton"),
    { on_loan: false, parent_club: null },
  );
  assert.deepEqual(
    resolveLoanMeta({ type_id: 218, date: "2026-08-15" }, "Brighton"),
    { on_loan: false, parent_club: null },
  );
  assert.deepEqual(
    resolveLoanMeta(loanTransfer({ fromTeam: { name: "Brighton" } }), "Brighton"),
    { on_loan: false, parent_club: null },
  );
});

test("loan meta: current-season loan with known parent", () => {
  assert.deepEqual(resolveLoanMeta(loanTransfer(), "Brighton"), {
    on_loan: true,
    parent_club: "Chelsea",
  });
});

test("loan in: club and parent update, provider_id stays", () => {
  const existing = [stored(1, "Chelsea", "pl")];
  const incoming = [
    fresh(1, "Brighton", "pl", { on_loan: true, parent_club: "Chelsea" }),
  ];
  const diff = diffClubSync({ existing, fresh: incoming, applyLeagueNow: false });
  assert.equal(diff.loans.length, 1);
  assert.equal(diff.loans[0].on_loan, true);
  assert.equal(diff.loans[0].parent_club, "Chelsea");
  const patch = diff.patches.find((p) => p.kind === "update");
  assert.equal(patch.provider_id, "sm-pl-1");
  assert.equal(patch.club, "Brighton");
  assert.equal(patch.on_loan, true);
  assert.equal(patch.league, "pl");
});

test("loan return: clears on_loan and parent", () => {
  const existing = [
    stored(2, "Brighton", "pl", { on_loan: true, parent_club: "Chelsea" }),
  ];
  const incoming = [fresh(2, "Chelsea", "pl", { on_loan: false, parent_club: null })];
  const diff = diffClubSync({ existing, fresh: incoming, applyLeagueNow: true });
  assert.equal(diff.loans.length, 1);
  assert.equal(diff.loans[0].on_loan, false);
  const patch = diff.patches.find((p) => p.kind === "update");
  assert.equal(patch.club, "Chelsea");
  assert.equal(patch.on_loan, false);
  assert.equal(patch.parent_club, null);
});

test("league change defers mid-week and applies on Friday unlock", () => {
  const existing = [stored(29709995, "Chelsea", "pl")];
  const city = [fresh(29709995, "Manchester City", "pl")];
  const sameLeague = diffClubSync({ existing, fresh: city, applyLeagueNow: false });
  assert.equal(sameLeague.patches[0].club, "Manchester City");
  assert.equal(sameLeague.patches[0].league, "pl");
  assert.equal(sameLeague.patches[0].deferredLeague, false);
  assert.equal(sameLeague.clubMoves.length, 1);
  assert.equal(sameLeague.leaguePending.length, 0);

  const toLaliga = [fresh(29709995, "Barcelona", "laliga")];
  const mid = diffClubSync({ existing, fresh: toLaliga, applyLeagueNow: false });
  assert.equal(mid.patches[0].club, "Barcelona");
  assert.equal(mid.patches[0].league, "pl");
  assert.equal(mid.patches[0].pending_league, "laliga");
  assert.equal(mid.patches[0].deferredLeague, true);
  assert.equal(mid.clubMoves.length, 1);
  assert.equal(mid.leaguePending.length, 1);

  const friday = diffClubSync({ existing, fresh: toLaliga, applyLeagueNow: true });
  assert.equal(friday.patches[0].league, "laliga");
  assert.equal(friday.patches[0].pending_league, null);
  assert.equal(friday.patches[0].league_moved_from, "pl");
  assert.equal(friday.patches[0].league_moved_to, "laliga");
});

test("pending league applies on Friday even without a fresh club change", () => {
  const existing = [
    stored(5, "Chelsea", "pl", {
      seed_metrics: { sportmonks_player_id: 5, pending_league: "seriea" },
    }),
  ];
  const patches = pendingLeaguePatches(existing, { applyLeagueNow: true });
  assert.equal(patches.length, 1);
  assert.equal(patches[0].league, "seriea");
  assert.equal(patches[0].league_moved_from, "pl");
});

test("departed player: inactive_flag with Left the five leagues", () => {
  const existing = [stored(7, "Arsenal", "pl"), stored(8, "Liverpool", "pl")];
  const incoming = [fresh(7, "Arsenal", "pl")];
  const diff = diffClubSync({ existing, fresh: incoming, applyLeagueNow: false });
  assert.equal(diff.departures.length, 1);
  assert.equal(diff.departures[0].name, "Player 8");
  const depart = diff.patches.find((p) => p.kind === "depart");
  assert.equal(depart.reason, "Left the five leagues");
});

test("owned gap: still in five leagues becomes a club move, not a departure", () => {
  const existing = [stored(10, "Aston Villa", "pl")];
  const owners = new Map([["uuid-10", { managerId: "m1", teamName: "Doumani" }]]);
  const diff = diffClubSync({ existing, fresh: [], applyLeagueNow: false, owners });
  assert.equal(diff.departures.length, 1);

  const teamById = new Map([[99, { league: "pl", club: "Aston Villa" }]]);
  const lookups = new Map([[10, { teamId: 99, teamName: "Aston Villa" }]]);
  const result = reconcileOwnedDepartures({
    departures: diff.departures,
    patches: diff.patches,
    lookups,
    teamById,
    existingById: new Map([["uuid-10", existing[0]]]),
    applyLeagueNow: false,
  });
  assert.equal(result.departures.length, 0);
  assert.equal(result.rescuedMoves.length, 1);
  assert.equal(result.rescuedMoves[0].toClub, "Aston Villa");
  assert.equal(result.patches.filter((p) => p.kind === "depart").length, 0);
  assert.equal(result.patches.filter((p) => p.kind === "update").length, 1);
});

test("owned gap: confirmed outside five leagues keeps departure with destination", () => {
  const existing = [stored(11, "AC Milan", "seriea")];
  const owners = new Map([["uuid-11", { managerId: "m1", teamName: "Doumani" }]]);
  const diff = diffClubSync({ existing, fresh: [], applyLeagueNow: false, owners });
  const lookups = new Map([[11, { teamId: 5000, teamName: "Al Hilal" }]]);
  const result = reconcileOwnedDepartures({
    departures: diff.departures,
    patches: diff.patches,
    lookups,
    teamById: new Map(),
    existingById: new Map([["uuid-11", existing[0]]]),
  });
  assert.equal(result.departures.length, 1);
  assert.equal(result.departures[0].destinationClub, "Al Hilal");
});

test("owned gap: lookup miss does not mark inactive", () => {
  const existing = [stored(12, "AC Milan", "seriea")];
  const owners = new Map([["uuid-12", { managerId: "m1", teamName: "Doumani" }]]);
  const diff = diffClubSync({ existing, fresh: [], applyLeagueNow: false, owners });
  const result = reconcileOwnedDepartures({
    departures: diff.departures,
    patches: diff.patches,
    lookups: new Map([[12, null]]),
    teamById: new Map(),
    existingById: new Map([["uuid-12", existing[0]]]),
  });
  assert.equal(result.departures.length, 0);
  assert.equal(result.patches.filter((p) => p.kind === "depart").length, 0);
});

test("duplicate prevention: league change updates existing row, never inserts", () => {
  const existing = [stored(9, "Chelsea", "pl")];
  const incoming = [fresh(9, "Juventus", "seriea")];
  const diff = diffClubSync({ existing, fresh: incoming, applyLeagueNow: true });
  assert.equal(diff.added.length, 0);
  assert.equal(diff.patches.filter((p) => p.kind === "insert").length, 0);
  assert.equal(diff.patches.filter((p) => p.kind === "update").length, 1);
  assert.equal(diff.patches[0].provider_id, "sm-pl-9");
  assert.equal(diff.patches[0].id, "uuid-9");
});

test("new squad player becomes a free-agent insert", () => {
  const existing = [stored(1, "Arsenal", "pl")];
  const incoming = [fresh(1, "Arsenal", "pl"), fresh(99, "Wolves", "pl")];
  const diff = diffClubSync({ existing, fresh: incoming, applyLeagueNow: false });
  assert.equal(diff.added.length, 1);
  assert.equal(diff.added[0].name, "Player 99");
  assert.equal(diff.patches.filter((p) => p.kind === "insert").length, 1);
});

test("owned movers sort first in the preview", () => {
  const existing = [stored(1, "A", "pl"), stored(2, "B", "pl")];
  const incoming = [fresh(1, "C", "pl"), fresh(2, "D", "pl")];
  const owners = new Map([["uuid-2", { managerId: "m1", teamName: "Doumani" }]]);
  const diff = diffClubSync({ existing, fresh: incoming, applyLeagueNow: false, owners });
  assert.equal(diff.moved[0].id, "uuid-2");
  assert.equal(diff.moved[0].owner.teamName, "Doumani");
  assert.equal(diff.clubMoves[0].id, "uuid-2");
});

test("splitMovePreview keeps club moves and Friday league rows separate", () => {
  const { clubMoves, leaguePending } = splitMovePreview([
    {
      name: "A",
      fromClub: "Chelsea",
      toClub: "City",
      fromLeague: "pl",
      toLeague: "pl",
      deferredLeague: false,
      owned: false,
    },
    {
      name: "B",
      fromClub: "Chelsea",
      toClub: "Barça",
      fromLeague: "pl",
      toLeague: "laliga",
      deferredLeague: true,
      owned: true,
    },
  ]);
  assert.equal(clubMoves.length, 2);
  assert.equal(leaguePending.length, 1);
  assert.equal(leaguePending[0].name, "B");
});

test("floor notice after a league move", () => {
  const player = {
    name: "Enzo Fernández",
    league: "laliga",
    seed_metrics: { league_moved_from: "pl", league_moved_to: "laliga" },
  };
  const line = floorMoveNotice(player, { pl: 2, laliga: 4, seriea: 3, bundesliga: 3, ligue1: 3 });
  assert.equal(
    line,
    "Enzo Fernández moved to LaLiga. You have 2 Premier League players, need 3.",
  );
});

test("floor: existing shortfall is not a penalty; worsening is blocked", () => {
  const short = [
    ...["a1", "a2"].map((id) => ({ id, league: "pl" })),
    ...["b1", "b2", "b3", "b4"].map((id) => ({ id, league: "laliga" })),
    ...["c1", "c2", "c3", "c4"].map((id) => ({ id, league: "seriea" })),
    ...["d1", "d2", "d3", "d4"].map((id) => ({ id, league: "bundesliga" })),
    ...["e1", "e2", "e3", "e4"].map((id) => ({ id, league: "ligue1" })),
  ];
  assert.equal(floorShortfall(short, ["a1"], [{ id: "x1", league: "pl" }]), null);
  const worse = floorShortfall(short, ["a1"], []);
  assert.deepEqual(worse, { league: "pl", count: 1, floor: 3 });
  assert.equal(floorMessage(worse), "This leaves you with 1 ENG. You need 3.");
});

test("isGstFriday: Friday Dubai is unlock day", () => {
  assert.equal(isGstFriday(new Date("2026-10-08T20:00:00Z")), true);
  assert.equal(isGstFriday(new Date("2026-10-07T20:00:00Z")), false);
});
