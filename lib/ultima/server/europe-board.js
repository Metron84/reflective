import { ULTIMA_LEAGUES, ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";
import { isLiveStatus, normalizeFixtureStatus } from "@/lib/ultima/fixture-status";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { runEuropeSync } from "@/lib/ultima/server/sync";
import {
  buildPlayerForm,
  buildTeamForm,
  pickHotCold,
} from "@/lib/ultima/server/form";

function dubaiDay(value) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function todayDubai() {
  return dubaiDay(new Date());
}

function fixtureSort(a, b) {
  const aLive = isLiveStatus(a.status) ? 0 : 1;
  const bLive = isLiveStatus(b.status) ? 0 : 1;
  if (aLive !== bLive) return aLive - bLive;
  const aToday = dubaiDay(a.kickoff_at ?? a.kickoff) === todayDubai() ? 0 : 1;
  const bToday = dubaiDay(b.kickoff_at ?? b.kickoff) === todayDubai() ? 0 : 1;
  if (aToday !== bToday) return aToday - bToday;
  return new Date(a.kickoff_at ?? a.kickoff) - new Date(b.kickoff_at ?? b.kickoff);
}

function difficultyFor(position, last) {
  if (!Number.isFinite(position) || !Number.isFinite(last) || last < 1) return "mid";
  const third = Math.ceil(last / 3);
  if (position <= third) return "hard";
  if (position > last - third) return "easy";
  return "mid";
}

function emptyDesk(extra = {}) {
  return {
    gameweek: null,
    fixtures: [],
    emptyReason: extra.emptyReason ?? null,
    syncError: extra.syncError ?? null,
    standings: {},
    form: { teams: { hot: [], cold: [] }, players: [] },
    movers: { rising: [], falling: [], manOfRound: [], upsets: [] },
    trending: { added: [], dropped: [], started: [], differentials: [], scorers: [] },
    ratingsAvailable: extra.ratingsAvailable ?? null,
    ...extra,
  };
}

async function loadPage(db, table, select, apply) {
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    let q = db.from(table).select(select).range(from, from + page - 1);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error || !data?.length) break;
    rows.push(...data);
    if (data.length < page) break;
  }
  return rows;
}

export async function getEuropeDesk(competitionId) {
  const db = getUltimaDb();
  if (!db || !competitionId) {
    return emptyDesk({ emptyReason: "sync", syncError: "no_db" });
  }

  const gameweek = await getCurrentGameweek(competitionId);
  const { data: syncRow, error: syncLookupErr } = await db
    .from("ultima_europe_sync")
    .select("last_ok_at, last_error, last_fixture_count, ratings_available")
    .eq("id", "europe")
    .maybeSingle();
  if (syncLookupErr) {
    console.error("ultima europe sync log", syncLookupErr.message);
  }

  const syncError = syncRow?.last_error ?? null;
  const ratingsAvailable = syncRow?.ratings_available ?? null;

  let fixtureQuery = db
    .from("ultima_fixtures")
    .select(
      "id, league, league_code, kickoff, kickoff_at, status, home_club, away_club, home_club_id, away_club_id, home_score, away_score, gameweek_id, sportmonks_fixture_id",
    )
    .order("kickoff", { ascending: true })
    .limit(80);

  if (gameweek?.id) {
    fixtureQuery = fixtureQuery.or(
      `gameweek_id.eq.${gameweek.id},status.in.(LIVE,HT)`,
    );
  }

  const { data: fixturesRaw, error: fixtureErr } = await fixtureQuery;
  if (fixtureErr) {
    console.error("ultima europe board", fixtureErr.message);
    return emptyDesk({
      emptyReason: "sync",
      syncError: fixtureErr.message,
      ratingsAvailable,
    });
  }

  const fixtures = (fixturesRaw ?? []).map((row) => ({
    ...row,
    status: normalizeFixtureStatus(row.status),
    leagueCode: row.league_code ?? ULTIMA_LEAGUE_SHORT[row.league] ?? row.league,
    kickoff: row.kickoff_at ?? row.kickoff,
  }));

  const standingsRows = await loadPage(
    db,
    "ultima_standings",
    "league, league_code, club_id, club_name, position, played, won, drawn, lost, goals_for, goals_against, points, previous_position",
  );

  const standings = Object.fromEntries(ULTIMA_LEAGUES.map((l) => [l, []]));
  for (const row of standingsRows) {
    if (standings[row.league]) standings[row.league].push(row);
  }
  for (const league of ULTIMA_LEAGUES) {
    standings[league].sort((a, b) => a.position - b.position);
  }

  const positionByClub = new Map();
  for (const row of standingsRows) {
    positionByClub.set(`${row.league}:${row.club_id}`, row.position);
    positionByClub.set(`${row.league}:${String(row.club_name).trim().toLowerCase()}`, row.position);
  }

  const rosters = await loadPage(
    db,
    "ultima_rosters",
    "player_id, manager_id, ultima_players(id, name, club, league), ultima_managers(id, team_name)",
    (q) => q.eq("competition_id", competitionId),
  );

  const ownersByPlayer = new Map();
  const ownedByClub = new Map();
  for (const row of rosters) {
    const player = row.ultima_players;
    if (!player?.id) continue;
    ownersByPlayer.set(player.id, {
      managerId: row.manager_id,
      teamName: row.ultima_managers?.team_name ?? "A manager",
    });
    const key = `${player.league}:${String(player.club ?? "").trim().toLowerCase()}`;
    const list = ownedByClub.get(key) ?? [];
    list.push(player.id);
    ownedByClub.set(key, list);
  }

  const strip = [...fixtures].sort(fixtureSort).map((row) => {
    const last = (standings[row.league] ?? []).length;
    const awayPos =
      positionByClub.get(`${row.league}:${row.away_club_id}`) ??
      positionByClub.get(`${row.league}:${String(row.away_club ?? "").toLowerCase()}`);
    const homePos =
      positionByClub.get(`${row.league}:${row.home_club_id}`) ??
      positionByClub.get(`${row.league}:${String(row.home_club ?? "").toLowerCase()}`);
    const ownedHome = ownedByClub.get(`${row.league}:${String(row.home_club ?? "").toLowerCase()}`) ?? [];
    const ownedAway = ownedByClub.get(`${row.league}:${String(row.away_club ?? "").toLowerCase()}`) ?? [];
    return {
      id: row.id,
      league: row.league,
      leagueCode: row.leagueCode,
      home: row.home_club,
      away: row.away_club,
      kickoff: row.kickoff,
      status: row.status,
      homeScore: row.home_score,
      awayScore: row.away_score,
      ownedCount: new Set([...ownedHome, ...ownedAway]).size,
      homeDifficulty: difficultyFor(awayPos, last),
      awayDifficulty: difficultyFor(homePos, last),
    };
  });

  const finished = await loadPage(
    db,
    "ultima_fixtures",
    "id, league, league_code, kickoff, kickoff_at, status, home_club, away_club, home_club_id, away_club_id, home_score, away_score",
    (q) => q.eq("status", "FT").order("kickoff", { ascending: false }).limit(400),
  );

  const clubs = standingsRows.map((row) => ({
    club_id: row.club_id,
    name: row.club_name,
    club_name: row.club_name,
    league: row.league,
    league_code: row.league_code,
  }));
  const teamForm = buildTeamForm(finished, clubs);
  const { hot, cold } = pickHotCold(teamForm);

  const stats = await loadPage(
    db,
    "ultima_player_match_stats",
    "player_id, fixture_id, goals, assists, rating, minutes, ultima_players(id, name, club, league), ultima_fixtures(id, kickoff, kickoff_at, league, status)",
    (q) => q.not("player_id", "is", null).order("updated_at", { ascending: false }).limit(3000),
  );

  const playerStatRows = (stats ?? [])
    .filter((row) => row.player_id && row.ultima_players?.name)
    .map((row) => ({
      player_id: row.player_id,
      name: row.ultima_players.name,
      club: row.ultima_players.club,
      league: row.ultima_players.league,
      goals: row.goals ?? 0,
      assists: row.assists ?? 0,
      rating: row.rating,
      minutes: row.minutes,
      kickoff: row.ultima_fixtures?.kickoff_at ?? row.ultima_fixtures?.kickoff,
    }));

  const playerForm = buildPlayerForm(playerStatRows).map((row) => {
    const sample = playerStatRows.find((s) => s.player_id === row.playerId);
    const owner = ownersByPlayer.get(row.playerId);
    return {
      ...row,
      name: sample?.name,
      club: sample?.club,
      owner: owner?.teamName ?? "Free agent",
    };
  });

  const rising = [...playerForm]
    .filter((row) => row.ratingDelta != null)
    .sort((a, b) => b.ratingDelta - a.ratingDelta)
    .slice(0, 5);
  const falling = [...playerForm]
    .filter((row) => {
      const minutesDrop =
        row.minutesTrend.length === 3 &&
        Number.isFinite(row.minutesTrend[0]) &&
        Number.isFinite(row.minutesTrend[2]) &&
        row.minutesTrend[2] - row.minutesTrend[0] >= 30;
      return (row.ratingDelta != null && row.ratingDelta < 0) || minutesDrop;
    })
    .sort((a, b) => {
      const aDrop = a.ratingDelta ?? 0;
      const bDrop = b.ratingDelta ?? 0;
      return aDrop - bDrop;
    })
    .slice(0, 5);

  const latestByLeague = {};
  for (const fix of finished) {
    const day = dubaiDay(fix.kickoff_at ?? fix.kickoff);
    if (!latestByLeague[fix.league] || day > latestByLeague[fix.league].day) {
      latestByLeague[fix.league] = { day, ids: new Set([fix.id]), rows: [fix] };
    } else if (day === latestByLeague[fix.league].day) {
      latestByLeague[fix.league].ids.add(fix.id);
      latestByLeague[fix.league].rows.push(fix);
    }
  }

  const manOfRoundCards = [];
  for (const league of ULTIMA_LEAGUES) {
    const pack = latestByLeague[league];
    if (!pack) continue;
    const candidates = (stats ?? []).filter(
      (row) =>
        row.player_id &&
        row.ultima_players?.league === league &&
        pack.ids.has(row.fixture_id) &&
        row.rating != null,
    );
    candidates.sort((a, b) => Number(b.rating) - Number(a.rating));
    const top = candidates[0];
    if (!top) continue;
    manOfRoundCards.push({
      playerId: top.player_id,
      name: top.ultima_players.name,
      club: top.ultima_players.club,
      league,
      leagueCode: ULTIMA_LEAGUE_SHORT[league],
      stat: Number(top.rating).toFixed(2),
      owner: ownersByPlayer.get(top.player_id)?.teamName ?? "Free agent",
    });
  }

  const history = await loadPage(
    db,
    "ultima_standings_history",
    "as_of, league, club_id, position",
  );
  const upsets = [];
  for (const league of ULTIMA_LEAGUES) {
    const pack = latestByLeague[league];
    if (!pack) continue;
    for (const fix of pack.rows) {
      if (fix.home_score == null || fix.away_score == null) continue;
      const asOf = dubaiDay(fix.kickoff_at ?? fix.kickoff);
      const snap = history.filter(
        (row) => row.league === league && String(row.as_of) < asOf,
      );
      const table = new Map();
      for (const row of snap) table.set(Number(row.club_id), row.position);
      if (!table.size) {
        for (const row of standings[league] ?? []) table.set(Number(row.club_id), row.position);
      }
      const last = (standings[league] ?? []).length || 20;
      const mid = last / 2;
      const homePos = table.get(Number(fix.home_club_id));
      const awayPos = table.get(Number(fix.away_club_id));
      if (!homePos || !awayPos) continue;
      const homeWin = fix.home_score > fix.away_score;
      const awayWin = fix.away_score > fix.home_score;
      if (homeWin && homePos > mid && awayPos <= mid) {
        upsets.push({
          id: fix.id,
          league,
          leagueCode: ULTIMA_LEAGUE_SHORT[league],
          line: `${fix.home_club} ${fix.home_score}-${fix.away_score} ${fix.away_club}`,
        });
      }
      if (awayWin && awayPos > mid && homePos <= mid) {
        upsets.push({
          id: fix.id,
          league,
          leagueCode: ULTIMA_LEAGUE_SHORT[league],
          line: `${fix.home_club} ${fix.home_score}-${fix.away_score} ${fix.away_club}`,
        });
      }
    }
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: txs } = await db
    .from("ultima_transactions")
    .select("type, player_id, created_at, ultima_players(name, club, league)")
    .gte("created_at", weekAgo)
    .limit(400);

  function topPlayers(kind) {
    const counts = new Map();
    for (const row of txs ?? []) {
      if (row.type !== kind || !row.player_id || !row.ultima_players?.name) continue;
      const cur = counts.get(row.player_id) ?? {
        playerId: row.player_id,
        name: row.ultima_players.name,
        club: row.ultima_players.club,
        count: 0,
      };
      cur.count += 1;
      counts.set(row.player_id, cur);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  }

  const added = topPlayers("add");
  const dropped = topPlayers("drop");

  let started = [];
  if (gameweek?.id) {
    const { data: lineups } = await db
      .from("ultima_lineups")
      .select("player_id, ultima_players(name, club, league)")
      .eq("gameweek_id", gameweek.id)
      .not("player_id", "is", null);
    const counts = new Map();
    const managers = new Set();
    for (const row of lineups ?? []) {
      managers.add(row);
    }
    const { count: xiCount } = await db
      .from("ultima_lineups")
      .select("manager_id", { count: "exact", head: true })
      .eq("gameweek_id", gameweek.id)
      .not("player_id", "is", null);
    const byManager = new Map();
    for (const row of lineups ?? []) {
      if (!row.player_id || !row.ultima_players?.name) continue;
      const cur = byManager.get(row.player_id) ?? {
        playerId: row.player_id,
        name: row.ultima_players.name,
        club: row.ultima_players.club,
        count: 0,
      };
      cur.count += 1;
      byManager.set(row.player_id, cur);
    }
    const submitted = Math.max(
      new Set((lineups ?? []).map((r) => r.player_id)).size ? 1 : 0,
      [...byManager.values()].reduce((m, r) => Math.max(m, r.count), 0),
    );
    const managerCount = new Set(
      (await db
        .from("ultima_lineups")
        .select("manager_id")
        .eq("gameweek_id", gameweek.id)
        .then(({ data }) => data ?? [])
      ).map((r) => r.manager_id),
    ).size;
    started = [...byManager.values()]
      .map((row) => ({
        ...row,
        share: managerCount ? Math.round((row.count / managerCount) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    void xiCount;
    void submitted;
    void managers;
  }

  const rosterCounts = new Map();
  for (const row of rosters) {
    rosterCounts.set(row.player_id, (rosterCounts.get(row.player_id) ?? 0) + 1);
  }
  const formTop = [...playerForm]
    .sort((a, b) => (b.last5.goals + b.last5.assists) - (a.last5.goals + a.last5.assists))
    .slice(0, 20);
  const differentials = formTop
    .filter((row) => (rosterCounts.get(row.playerId) ?? 0) <= 2)
    .slice(0, 5)
    .map((row) => ({
      playerId: row.playerId,
      name: row.name,
      club: row.club,
      owned: rosterCounts.get(row.playerId) ?? 0,
    }));

  let scorers = [];
  if (gameweek?.id) {
    const gwFixIds = fixtures.filter((f) => f.gameweek_id === gameweek.id).map((f) => f.id);
    const gwStats = (stats ?? []).filter((row) => gwFixIds.includes(row.fixture_id) && row.player_id);
    const byPlayer = new Map();
    for (const row of gwStats) {
      const cur = byPlayer.get(row.player_id) ?? {
        playerId: row.player_id,
        name: row.ultima_players?.name,
        club: row.ultima_players?.club,
        goals: 0,
        assists: 0,
        points: 0,
      };
      cur.goals += row.goals ?? 0;
      cur.assists += row.assists ?? 0;
      cur.points += (row.goals ?? 0) * 3 + (row.assists ?? 0);
      byPlayer.set(row.player_id, cur);
    }
    scorers = [...byPlayer.values()]
      .filter((row) => row.name && row.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 5)
      .map((row) => ({
        ...row,
        owner: ownersByPlayer.get(row.playerId)?.teamName ?? "Free agent",
      }));
  }

  let emptyReason = null;
  if (!strip.length) {
    if (syncError || !syncRow?.last_ok_at) emptyReason = "sync";
    else emptyReason = "break";
  }

  return {
    gameweek: Number.isInteger(gameweek?.number) ? gameweek.number : null,
    fixtures: strip,
    emptyReason,
    syncError: emptyReason === "sync" ? syncError || "Sync did not land." : null,
    standings,
    form: {
      teams: { hot, cold, all: teamForm },
      players: playerForm
        .sort((a, b) => (b.last5.goals + b.last5.assists) - (a.last5.goals + a.last5.assists))
        .slice(0, 20),
    },
    movers: {
      rising: rising.map((row) => ({
        playerId: row.playerId,
        name: row.name,
        club: row.club,
        leagueCode: ULTIMA_LEAGUE_SHORT[row.league],
        stat: row.ratingDelta != null ? `+${row.ratingDelta.toFixed(2)}` : "",
        owner: row.owner,
      })),
      falling: falling.map((row) => ({
        playerId: row.playerId,
        name: row.name,
        club: row.club,
        leagueCode: ULTIMA_LEAGUE_SHORT[row.league],
        stat: row.ratingDelta != null ? row.ratingDelta.toFixed(2) : "minutes",
        owner: row.owner,
      })),
      manOfRound: manOfRoundCards,
      upsets: upsets.slice(0, 8),
    },
    trending: {
      added: added.length >= 3 ? added : [],
      dropped: dropped.length >= 3 ? dropped : [],
      started: started.length >= 3 ? started : [],
      differentials: differentials.length >= 3 ? differentials : [],
      scorers: scorers.length >= 3 ? scorers : [],
    },
    ratingsAvailable,
  };
}

/** First seated-manager open fills fixtures and tables if cron has not run yet. */
export async function ensureEuropeDesk(competitionId) {
  const db = getUltimaDb();
  if (!db || !competitionId) return emptyDesk({ emptyReason: "sync", syncError: "no_db" });

  const { data: syncRow } = await db
    .from("ultima_europe_sync")
    .select("last_ok_at")
    .eq("id", "europe")
    .maybeSingle();

  if (!syncRow?.last_ok_at) {
    const gameweek = await getCurrentGameweek(competitionId);
    await runEuropeSync(competitionId, gameweek, { skipStats: true });
  }

  return getEuropeDesk(competitionId);
}

/** @deprecated use getEuropeDesk */
export async function getEuropeBoard(competitionId) {
  return getEuropeDesk(competitionId);
}
