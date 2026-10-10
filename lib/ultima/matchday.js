import { ULTIMA_LEAGUES, ULTIMA_DEFAULT_RATING_THRESHOLDS, leagueLabel } from "./constants.js";
import { CAPTAIN_MULTIPLIER, captainIdSet, resolveCaptains } from "./captains.js";
import { isFinishedStatus, isLiveStatus, normalizeFixtureStatus } from "./fixture-status.js";
import { formatGstDateTime } from "./gst.js";
import { xvSlotLocked } from "./lineup/lock.js";
import { ratingPoints, scoreSlot } from "./scoring.js";

/**
 * Matchday view model. Pure: queries live in server/matchday.js.
 * Everything a manager sees on the page is built here, so the bug cases
 * (no fixtures in a league, empty XV, captain gone) are testable without a database.
 */

/** Status chip text for a fixture row. */
export function fixtureStatusLabel(status) {
  const s = normalizeFixtureStatus(status);
  if (s === "LIVE") return "LIVE";
  if (s === "HT") return "HT";
  if (s === "FT") return "FT";
  if (s === "POSTP") return "Postponed";
  if (s === "CANC") return "Cancelled";
  return "";
}

function fixtureView(row) {
  const status = normalizeFixtureStatus(row.status);
  const kickoffIso = row.kickoff_at ?? row.kickoff ?? null;
  const hasScore = row.home_score != null && row.away_score != null;
  return {
    id: row.id,
    league: row.league,
    kickoffIso,
    kickoff: formatGstDateTime(kickoffIso),
    status,
    statusLabel: fixtureStatusLabel(status),
    live: isLiveStatus(status),
    finished: isFinishedStatus(status),
    home: row.home_club ?? "-",
    away: row.away_club ?? "-",
    score: hasScore && status !== "NS" ? `${row.home_score} - ${row.away_score}` : null,
  };
}

/** Fixtures grouped by league. All five leagues always appear, empty ones with no rows. */
export function groupFixtures(fixtures) {
  return ULTIMA_LEAGUES.map((league) => ({
    league,
    label: leagueLabel(league),
    fixtures: (fixtures ?? [])
      .filter((f) => f.league === league)
      .map(fixtureView)
      .sort((a, b) => String(a.kickoffIso).localeCompare(String(b.kickoffIso))),
  }));
}

/** Per-player raw points so far (base plus Bolt), before any captain doubling. */
export function rawPointsByPlayer(stats, playersById, thresholds = ULTIMA_DEFAULT_RATING_THRESHOLDS) {
  return scorePlayers(stats, playersById, thresholds).totals;
}

/** Totals (base plus Bolt) and the Bolt part alone, so a captain doubles base only. */
export function scorePlayers(stats, playersById, thresholds = ULTIMA_DEFAULT_RATING_THRESHOLDS) {
  const byPlayer = new Map();
  for (const row of stats ?? []) {
    if (!row.player_id) continue;
    const list = byPlayer.get(row.player_id) ?? [];
    list.push(row);
    byPlayer.set(row.player_id, list);
  }
  const out = new Map();
  const bolts = new Map();
  const parts = new Map();
  for (const [id, rows] of byPlayer) {
    const player = playersById.get(id);
    if (!player) continue;
    const leagueThresholds = thresholds[player.league] ?? thresholds.pl ?? ULTIMA_DEFAULT_RATING_THRESHOLDS.pl;
    let goals = 0;
    let assists = 0;
    let rawGoals = 0;
    let rawAssists = 0;
    let rating = 0;
    for (const stat of rows) {
      rawGoals += Number(stat.goals ?? 0);
      rawAssists += Number(stat.assists ?? 0);
      goals += Number(stat.goals ?? 0) * 3;
      assists += Number(stat.assists ?? 0);
      rating += ratingPoints(stat.rating, leagueThresholds);
    }
    const scored = scoreSlot(
      rows,
      {
        league: player.league,
        draftRound: player.draft_round,
        undraftedFa: !player.draft_round && Boolean(player.bolt_eligible),
      },
      thresholds,
    );
    out.set(id, scored.total);
    bolts.set(id, scored.bolt);
    parts.set(id, {
      goals,
      assists,
      rating,
      base: goals + assists + rating,
      bolt: scored.bolt,
      rawGoals,
      rawAssists,
    });
  }
  return { totals: out, bolts, parts };
}

/**
 * One manager's XV for the matchday: rows per country, captains marked, points
 * so far with the captain's doubled.
 */
export function buildManagerXv({ lineupRows, prevCaptains, playersById, rawPoints, boltPoints = new Map(), parts = new Map(), visibleLeagues }) {
  const resolved = resolveCaptains(lineupRows ?? [], prevCaptains);
  const captainIds = captainIdSet(resolved.byLeague);
  const filled = (lineupRows ?? []).filter((r) => r.player_id);

  let total = 0;
  const countries = ULTIMA_LEAGUES.map((league) => {
    const visible = visibleLeagues.has(league);
    const rows = filled
      .filter((r) => r.slot_group === league)
      .sort((a, b) => a.slot - b.slot)
      .map((r) => {
        const player = playersById.get(r.player_id);
        const raw = rawPoints.get(r.player_id) ?? 0;
        const captain = captainIds.has(r.player_id);
        const split = parts.get(r.player_id) ?? { goals: 0, assists: 0, rating: 0, base: 0, bolt: 0 };
        // The captain doubles base points. The +2 Bolt is added after and never doubled.
        const bolt = boltPoints.get(r.player_id) ?? split.bolt ?? 0;
        const base = split.base ?? raw - bolt;
        const captainExtra = captain ? base * (CAPTAIN_MULTIPLIER - 1) : 0;
        const points = base + captainExtra + bolt;
        total += points;
        return {
          playerId: r.player_id,
          name: player?.name ?? "-",
          club: player?.club ?? "",
          captain,
          raw,
          goals: split.goals,
          assists: split.assists,
          rating: split.rating,
          captainExtra,
          bolt,
          points,
        };
      });
    return { league, label: leagueLabel(league), visible, rows: visible ? rows : [] , hiddenCount: visible ? 0 : rows.length };
  });

  return {
    countries,
    total,
    captains: resolved.byLeague,
    captainCount: Object.values(resolved.byLeague).filter(Boolean).length,
    filledCount: filled.length,
  };
}

/** Total, then goals, then assists, then reverse draft slot. Equal totals share a rank. */
export function rankManagers(rows) {
  const sorted = [...rows].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if ((b.goals ?? 0) !== (a.goals ?? 0)) return (b.goals ?? 0) - (a.goals ?? 0);
    if ((b.assists ?? 0) !== (a.assists ?? 0)) return (b.assists ?? 0) - (a.assists ?? 0);
    if ((b.draftSlot ?? 0) !== (a.draftSlot ?? 0)) return (b.draftSlot ?? 0) - (a.draftSlot ?? 0);
    return String(a.name).localeCompare(String(b.name));
  });
  let rank = 0;
  let last = null;
  return sorted.map((row, index) => {
    if (row.total !== last) rank = index + 1;
    last = row.total;
    return { ...row, rank };
  });
}

/**
 * @param {object} input
 * @param {object|null} input.gameweek
 * @param {object[]} input.fixtures      ultima_fixtures rows for the gameweek
 * @param {object[]} input.managers      { id, team_name, colour, is_bot }
 * @param {object[]} input.lineups       ultima_lineups rows for the gameweek, all managers
 * @param {Map<string, object>} input.playersById
 * @param {object[]} input.stats         ultima_player_match_stats rows for the gameweek
 * @param {object[]|null} [input.scores] stored ultima_manager_gameweek_scores rows. Null derives totals from the XV.
 * @param {Record<string, Record<string,string>>} [input.prevCaptains] manager id -> league -> player id
 * @param {string|null} input.viewerManagerId
 * @param {object} [input.thresholds]
 * @param {number} [input.now]
 */
export function buildMatchday({
  gameweek,
  fixtures = [],
  managers = [],
  lineups = [],
  playersById = new Map(),
  stats = [],
  scores = null,
  prevCaptains = {},
  viewerManagerId = null,
  thresholds = ULTIMA_DEFAULT_RATING_THRESHOLDS,
  sample = false,
  now = Date.now(),
}) {
  if (!gameweek) return { noGameweek: true };

  const { totals: rawPoints, bolts: boltPoints, parts } = scorePlayers(stats, playersById, thresholds);
  const scoreByManager = new Map((scores ?? []).map((row) => [row.manager_id, row]));
  const liveClubs = new Set();
  for (const fixture of fixtures ?? []) {
    if (!isLiveStatus(fixture.status)) continue;
    for (const name of [fixture.home_club, fixture.away_club]) {
      const key = String(name ?? "").trim().toLowerCase();
      if (key) liveClubs.add(key);
    }
  }
  const final = gameweek.state === "final";
  const openLeagues = new Set(
    ULTIMA_LEAGUES.filter((league) => final || xvSlotLocked(gameweek, league, now)),
  );
  const allLeagues = new Set(ULTIMA_LEAGUES);

  const built = managers.map((manager) => {
    const rows = lineups.filter((r) => r.manager_id === manager.id);
    const mine = manager.id === viewerManagerId;
    const xv = buildManagerXv({
      lineupRows: rows,
      prevCaptains: prevCaptains[manager.id] ?? null,
      playersById,
      rawPoints,
      boltPoints,
      parts,
      visibleLeagues: mine ? allLeagues : openLeagues,
    });
    const stored = scoreByManager.get(manager.id);
    const storedTotal = stored ? Number(stored.points) + Number(stored.bolt_points) : 0;
    let goals = 0;
    let assists = 0;
    for (const row of rows) {
      if (!row.player_id || !openLeagues.has(row.slot_group)) continue;
      const split = parts.get(row.player_id);
      goals += split?.rawGoals ?? 0;
      assists += split?.rawAssists ?? 0;
    }
    const live = (lineups ?? [])
      .filter((row) => row.manager_id === manager.id && row.player_id)
      .some((row) => liveClubs.has(String(playersById.get(row.player_id)?.club ?? "").trim().toLowerCase()));
    return {
      id: manager.id,
      name: manager.team_name,
      colour: manager.colour,
      isBot: Boolean(manager.is_bot),
      yours: mine,
      live,
      goals,
      assists,
      bolt: stored ? Number(stored.bolt_points) || 0 : 0,
      draftSlot: Number(manager.draft_slot) || 0,
      total: Array.isArray(scores) ? (Number.isFinite(storedTotal) ? storedTotal : 0) : xv.total,
      xv,
    };
  });

  const ranked = rankManagers(built);
  const you = ranked.find((m) => m.yours) ?? null;
  const fixtureGroups = groupFixtures(fixtures);
  const anyFixtures = fixtureGroups.some((g) => g.fixtures.length > 0);
  const anyLive = fixtureGroups.some((g) => g.fixtures.some((f) => f.live));
  const kickedOff = fixtureGroups.some((g) =>
    g.fixtures.some((f) => f.kickoffIso && new Date(f.kickoffIso).getTime() <= now),
  );

  let updatedAt = null;
  for (const row of scores ?? []) {
    if (!row.updated_at) continue;
    if (!updatedAt || row.updated_at > updatedAt) updatedAt = row.updated_at;
  }

  return {
    noGameweek: false,
    sample: Boolean(sample),
    updatedAt,
    gameweek: { id: gameweek.id, number: gameweek.number, state: gameweek.state },
    fixtures: fixtureGroups,
    anyFixtures,
    anyLive,
    // Worth polling while a match is on or just kicked off and not all finished.
    waitingForStats: anyFixtures && (stats ?? []).length === 0,
    pollable: anyLive || (kickedOff && fixtureGroups.some((g) => g.fixtures.some((f) => !f.finished && f.status !== "POSTP" && f.status !== "CANC"))),
    you: you
      ? { id: you.id, name: you.name, total: you.total, rank: you.rank, xv: you.xv }
      : null,
    managers: ranked.map(({ xv, ...m }) => ({ ...m, xv })),
  };
}
