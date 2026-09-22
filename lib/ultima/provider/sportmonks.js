import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { leagueCodeForSlug, normalizeFixtureStatus } from "@/lib/ultima/fixture-status";
import {
  SPORTMONKS_BASE,
  getSportmonksLeagueId,
  getSportmonksLeagueMap,
  sportmonksApiKey,
  statTypeIds,
} from "@/lib/ultima/provider/sportmonks-config";

async function smFetchRaw(path, params = {}) {
  const key = sportmonksApiKey();
  if (!key) {
    const err = new Error("SPORTMONKS_API_KEY not configured");
    err.status = 0;
    throw err;
  }

  const url = new URL(`${SPORTMONKS_BASE}${path}`);
  url.searchParams.set("api_token", key);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  return { status: res.status, ok: res.ok, json, path };
}

async function smFetch(path, params = {}) {
  const result = await smFetchRaw(path, params);
  if (!result.ok) {
    const err = new Error(`Sportmonks ${path} returned ${result.status}`);
    err.status = result.status;
    err.plan = result.status === 403 || result.status === 401;
    throw err;
  }
  return result.json;
}

function readScores(fixture) {
  const scores = Array.isArray(fixture?.scores) ? fixture.scores : [];
  const current = scores.filter((row) => {
    const label = String(
      row.description ?? row.type?.developer_name ?? row.type?.name ?? "",
    ).toUpperCase();
    return label.includes("CURRENT") || label === "2ND_HALF" || label === "FULLTIME";
  });
  const pool = current.length ? current : [];

  let home = null;
  let away = null;
  for (const row of pool) {
    const loc = String(row.score?.participant ?? row.participant ?? "").toLowerCase();
    const goals = row.score?.goals ?? row.goals;
    if (goals == null || !Number.isFinite(Number(goals))) continue;
    if (loc === "home") home = Number(goals);
    if (loc === "away") away = Number(goals);
  }

  if (home == null || away == null) {
    return { home_score: null, away_score: null };
  }
  return { home_score: home, away_score: away };
}

function participantAt(fixture, location) {
  return (fixture?.participants ?? []).find(
    (row) => String(row.meta?.location ?? "").toLowerCase() === location,
  );
}

function mapFixture(f, league) {
  const home = participantAt(f, "home");
  const away = participantAt(f, "away");
  const scores = readScores(f);
  const stateRaw =
    f.state?.short_name ?? f.state?.developer_name ?? f.state?.state ?? f.state?.name;

  return {
    provider_id: `sm-fix-${f.id}`,
    sportmonks_fixture_id: f.id,
    league,
    league_code: leagueCodeForSlug(league),
    kickoff: f.starting_at,
    kickoff_at: f.starting_at,
    status: normalizeFixtureStatus(stateRaw),
    home_club: home?.name ?? null,
    away_club: away?.name ?? null,
    home_club_id: home?.id ?? null,
    away_club_id: away?.id ?? null,
    home_score: scores.home_score,
    away_score: scores.away_score,
  };
}

function standingNumber(row, keys) {
  for (const key of keys) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function standingFromDetails(details, keys) {
  for (const row of details ?? []) {
    const code = String(row.type?.developer_name ?? row.type?.code ?? "").toUpperCase();
    if (code && code !== "OVERALL" && !keys.includes(code)) continue;
    const value = row.value;
    if (value && typeof value === "object") {
      for (const key of keys) {
        const n = Number(value[key]);
        if (Number.isFinite(n)) return n;
      }
    }
    if (keys.includes(code) && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function mapStanding(row, league, seasonId) {
  const details = row.details ?? [];
  const previous =
    Number(row.previous_position) ||
    standingFromDetails(details, ["PREVIOUS_POSITION", "previous_position"]) ||
    null;

  return {
    league,
    league_code: leagueCodeForSlug(league),
    season_id: Number(row.season_id ?? seasonId),
    club_id: Number(row.participant_id ?? row.team_id ?? row.participant?.id),
    club_name: row.participant?.name ?? row.team?.name ?? row.name ?? "",
    position: Number(row.position),
    played:
      standingFromDetails(details, ["GAMES_PLAYED", "played", "games_played"]) ??
      standingNumber(row, ["played", "games_played"]),
    won: standingFromDetails(details, ["WON", "won"]) ?? standingNumber(row, ["won"]),
    drawn:
      standingFromDetails(details, ["DRAW", "DRAWN", "drawn"]) ??
      standingNumber(row, ["drawn", "draw"]),
    lost: standingFromDetails(details, ["LOST", "lost"]) ?? standingNumber(row, ["lost"]),
    goals_for:
      standingFromDetails(details, ["GOALS_FOR", "goals_for"]) ??
      standingNumber(row, ["goals_for", "gf"]),
    goals_against:
      standingFromDetails(details, ["GOALS_AGAINST", "goals_against"]) ??
      standingNumber(row, ["goals_against", "ga"]),
    points: standingFromDetails(details, ["POINTS", "points"]) ?? standingNumber(row, ["points"]),
    previous_position: Number.isFinite(Number(previous)) ? Number(previous) : null,
  };
}

/** A full league campaign, used to turn minutes played into a reliability share. */
const SEASON_MINUTES = 38 * 90;

/** Match-level variance has no season-aggregate source, so everyone sits neutral. */
const NEUTRAL_CONSISTENCY = 0.3;

/** Squad endpoint pages; five leagues never approach this, it only stops a runaway loop. */
const MAX_TEAM_PAGES = 20;

/** Club stat lookups run in parallel, but not so wide that Sportmonks rate limits us. */
const STATS_CONCURRENCY = 6;

/** Ratings are optional. Past this the league keeps its squads and takes averages. */
const STATS_BUDGET_MS = 12000;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

/** Sportmonks wraps stat values differently per type, so unwrap defensively. */
function readStatValue(detail) {
  const raw = detail?.value ?? detail?.data?.value ?? detail?.data;
  if (raw == null) return null;

  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const picked = raw.total ?? raw.average ?? raw.value ?? raw.count;
  const parsed = Number(picked);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The most recently completed season, which is what a draft should be rated on. */
function pickPreviousSeason(seasons, currentId) {
  const past = (seasons ?? [])
    .filter((s) => s?.id && s.id !== currentId)
    .sort((a, b) =>
      String(b.ending_at ?? b.starting_at ?? "").localeCompare(
        String(a.ending_at ?? a.starting_at ?? ""),
      ),
    );

  return past[0] ?? null;
}

/** Season totals from a squad entry's stat details, or null when they did not feature. */
function readDetailTotals(details) {
  const types = statTypeIds();

  let goals = 0;
  let assists = 0;
  let minutes = 0;
  let appearances = 0;
  let rating = null;

  for (const detail of details ?? []) {
    const typeId = detail?.type_id ?? detail?.type?.id;
    const value = readStatValue(detail);
    if (value == null) continue;

    if (typeId === types.goals) goals += value;
    else if (typeId === types.assists) assists += value;
    else if (typeId === types.minutes) minutes += value;
    else if (typeId === types.appearances) appearances += value;
    else if (typeId === types.rating) rating = value;
  }

  if (!appearances && !minutes && rating == null) return null;
  return { goals, assists, minutes, appearances, rating };
}

/** Run tasks a few at a time so a hundred club calls do not go out serially. */
async function mapWithConcurrency(items, limit, worker) {
  const queue = [...items];

  async function run() {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

/** Season totals to the seed metrics the draft board and bots read. */
function totalsToMetrics(totals) {
  // Some plans report appearances without minutes. A rough 70 per appearance
  // keeps the per-90 rates honest rather than dividing by zero.
  const minutes = totals.minutes > 0 ? totals.minutes : totals.appearances * 70;
  const per90 = minutes > 0 ? 90 / minutes : 0;

  return {
    goals_rate: round3(clamp(totals.goals * per90, 0, 3)),
    assists_rate: round3(clamp(totals.assists * per90, 0, 3)),
    rating_avg: totals.rating == null ? null : round3(clamp(totals.rating, 0, 10)),
    minutes_reliability: round3(clamp(minutes / SEASON_MINUTES, 0, 1)),
  };
}

function normalisePlayer(row, league, clubName, metrics, clubStrength) {
  const id = row.player_id ?? row.id;
  const name = row.display_name ?? row.name ?? row.common_name ?? "Unknown";

  return {
    provider_id: `sm-${league}-${id}`,
    name,
    club: clubName ?? row.team?.name ?? "Unknown",
    league,
    active: true,
    goals_rate: metrics?.goals_rate ?? null,
    assists_rate: metrics?.assists_rate ?? null,
    rating_avg: metrics?.rating_avg ?? null,
    rating_consistency: NEUTRAL_CONSISTENCY,
    minutes_reliability: metrics?.minutes_reliability ?? null,
    club_strength: clubStrength ?? null,
    has_season_stats: Boolean(metrics),
    sportmonks_player_id: id,
  };
}

/**
 * New signings, promoted squads and academy players carry no prior-season record.
 * They take the league average so they stay draftable without being favoured.
 */
function fillGapsWithLeagueAverage(players) {
  const fields = ["goals_rate", "assists_rate", "rating_avg", "minutes_reliability", "club_strength"];
  const fallbacks = { goals_rate: 0.1, assists_rate: 0.05, rating_avg: 6.5, minutes_reliability: 0.5, club_strength: 0.5 };
  const averages = {};

  for (const field of fields) {
    const values = players.map((p) => p[field]).filter((v) => typeof v === "number");
    averages[field] = values.length
      ? round3(values.reduce((sum, v) => sum + v, 0) / values.length)
      : fallbacks[field];
  }

  for (const player of players) {
    for (const field of fields) {
      if (typeof player[field] !== "number") player[field] = averages[field];
    }
  }

  return players;
}

/**
 * Sportmonks adapter (v5). Requires league IDs in env per docs/ultima-provider-mapping.md
 */
export class SportmonksProvider {
  #playerCache = new Map();

  /** Why a league came back empty, so a failed sync can explain itself. */
  #reasons = new Map();

  /** Per-league share of players carrying real prior-season statistics. */
  #coverage = new Map();

  #ready() {
    return Boolean(sportmonksApiKey());
  }

  #fail(league, reason) {
    this.#reasons.set(league, reason);
    this.#coverage.delete(league);
    this.#playerCache.set(league, []);
    return [];
  }

  async #loadLeaguePlayers(league) {
    if (this.#playerCache.has(league)) {
      return this.#playerCache.get(league);
    }

    const leagueId = getSportmonksLeagueId(league);
    if (!leagueId) {
      return this.#fail(league, "No league ID in the environment.");
    }

    try {
      const seasonRes = await smFetch(`/leagues/${leagueId}`, {
        include: "currentSeason",
      });
      const seasonId =
        seasonRes?.data?.currentseason?.id ??
        seasonRes?.data?.currentSeason?.id ??
        seasonRes?.data?.current_season_id;

      if (!seasonId) {
        return this.#fail(
          league,
          `League ${leagueId} returned no current season. Check the league ID.`,
        );
      }

      // Squads first, on their own, using nothing but the call we know works.
      // Everything below this point is enrichment and must never empty the pool.
      const teams = await this.#fetchSeasonSquads(seasonId);

      if (!teams.length) {
        return this.#fail(league, `Season ${seasonId} returned no clubs.`);
      }

      const ratings = await this.#loadRatings(leagueId, seasonId, teams);

      const players = [];
      for (const team of teams) {
        const club = team.name ?? "Unknown";
        const strength = ratings.clubStrength.get(team.id) ?? null;

        for (const entry of team.players ?? []) {
          const p = entry.player ?? entry;
          if (!p?.id) continue;

          const totals = ratings.byPlayer.get(p.id) ?? null;
          players.push(
            normalisePlayer(p, league, club, totals ? totalsToMetrics(totals) : null, strength),
          );
        }
      }

      if (!players.length) {
        return this.#fail(
          league,
          `${teams.length} clubs returned, none with squads. Your plan may not include squad data.`,
        );
      }

      this.#coverage.set(league, {
        rated: players.filter((p) => p.has_season_stats).length,
        total: players.length,
        season: ratings.seasonName,
        error: ratings.error,
      });

      fillGapsWithLeagueAverage(players);

      this.#reasons.delete(league);
      this.#playerCache.set(league, players);
      return players;
    } catch (err) {
      return this.#fail(league, err?.message ?? "Request failed.");
    }
  }

  /** The squad call, unchanged from the one proven to return full squads. */
  async #fetchSeasonSquads(seasonId) {
    const teams = [];

    for (let page = 1; page <= MAX_TEAM_PAGES; page += 1) {
      const params = { include: "players.player" };
      if (page > 1) params.page = page;

      const res = await smFetch(`/teams/seasons/${seasonId}`, params);
      teams.push(...(res?.data ?? []));
      if (!res?.pagination?.has_more) break;
    }

    return teams;
  }

  /**
   * Prior-season ratings, entirely best effort. Any failure here leaves players
   * on their league average rather than costing us the squad.
   */
  async #loadRatings(leagueId, currentSeasonId, teams) {
    const empty = {
      byPlayer: new Map(),
      clubStrength: new Map(),
      seasonName: null,
      error: null,
    };

    try {
      const seasonsRes = await smFetch(`/leagues/${leagueId}`, { include: "seasons" });
      const previous = pickPreviousSeason(seasonsRes?.data?.seasons, currentSeasonId);

      if (!previous?.id) {
        return { ...empty, error: "No completed season to rate from." };
      }

      const [byPlayer, clubStrength] = await Promise.all([
        this.#fetchSquadStats(previous.id, teams),
        this.#fetchClubStrength(previous.id),
      ]);

      return {
        byPlayer,
        clubStrength,
        seasonName: previous.name ?? null,
        error: byPlayer.size ? null : "No prior-season stats returned.",
      };
    } catch (err) {
      return { ...empty, error: err?.message ?? "Ratings lookup failed." };
    }
  }

  /** Prior-season stat totals per player, gathered one club at a time. */
  async #fetchSquadStats(seasonId, teams) {
    const types = statTypeIds();
    const typeFilter = [
      types.goals,
      types.assists,
      types.rating,
      types.minutes,
      types.appearances,
    ].join(",");

    const byPlayer = new Map();
    const deadline = Date.now() + STATS_BUDGET_MS;
    const teamIds = teams.map((t) => t?.id).filter(Boolean);

    await mapWithConcurrency(teamIds, STATS_CONCURRENCY, async (teamId) => {
      if (Date.now() > deadline) return;

      try {
        const res = await smFetch(`/squads/seasons/${seasonId}/teams/${teamId}`, {
          include: "details",
          filters: `playerstatisticdetailTypes:${typeFilter}`,
        });

        for (const row of res?.data ?? []) {
          const playerId = row?.player_id;
          if (!playerId || byPlayer.has(playerId)) continue;

          const totals = readDetailTotals(row.details);
          if (totals) byPlayer.set(playerId, totals);
        }
      } catch {
        // One club missing its history is not worth failing the league over.
      }
    });

    return byPlayer;
  }

  /** Final league position as a 0-1 strength score. Empty map falls back to average. */
  async #fetchClubStrength(seasonId) {
    const strength = new Map();

    try {
      const res = await smFetch(`/standings/seasons/${seasonId}`);
      const rows = res?.data ?? [];
      const positions = rows.map((r) => Number(r.position)).filter(Number.isFinite);
      if (!positions.length) return strength;

      const last = Math.max(...positions);
      const spread = Math.max(last - 1, 1);

      for (const row of rows) {
        const teamId = row.participant_id ?? row.team_id;
        const position = Number(row.position);
        if (!teamId || !Number.isFinite(position)) continue;
        strength.set(teamId, round3(clamp(1 - (position - 1) / spread, 0, 1)));
      }
    } catch {
      // Standings are a nice-to-have. Without them every club sits at the average.
    }

    return strength;
  }

  /** How many players per league carried real prior-season stats. */
  getStatsCoverage() {
    return Object.fromEntries(this.#coverage);
  }

  /** Per-league failure reasons from the most recent load. */
  getDiagnostics() {
    return Object.fromEntries(this.#reasons);
  }

  getPlayers(league) {
    if (!this.#ready()) return [];
    const cached = this.#playerCache.get(league);
    if (cached) return cached;
    return [];
  }

  async fetchPlayers(league) {
    return this.#loadLeaguePlayers(league);
  }

  getAllPlayers() {
    return ULTIMA_LEAGUES.flatMap((l) => this.getPlayers(l));
  }

  async fetchAllPlayers() {
    const all = [];
    for (const league of ULTIMA_LEAGUES) {
      const rows = await this.#loadLeaguePlayers(league);
      all.push(...rows);
    }
    return all;
  }

  getFixtures(league, from, to) {
    return [];
  }

  async getCurrentSeasonId(league) {
    const leagueId = getSportmonksLeagueId(league);
    if (!leagueId) return null;
    const res = await smFetch(`/leagues/${leagueId}`, { include: "currentSeason" });
    return (
      res?.data?.currentseason?.id ??
      res?.data?.currentSeason?.id ??
      res?.data?.current_season_id ??
      null
    );
  }

  async fetchFixtures(league, from, to) {
    const leagueId = getSportmonksLeagueId(league);
    if (!leagueId || !from || !to) return [];

    const fromDate = String(from).slice(0, 10);
    const toDate = String(to).slice(0, 10);
    const res = await smFetch(`/fixtures/between/${fromDate}/${toDate}`, {
      include: "participants;scores;state",
      filters: `fixtureLeagues:${leagueId}`,
    });
    return (res?.data ?? []).map((f) => mapFixture(f, league));
  }

  async fetchStandings(league) {
    const seasonId = await this.getCurrentSeasonId(league);
    if (!seasonId) return { seasonId: null, rows: [] };

    const res = await smFetch(`/standings/seasons/${seasonId}`, {
      include: "participant;details.type",
    });
    const rows = (res?.data ?? [])
      .map((row) => mapStanding(row, league, seasonId))
      .filter((row) => row.club_id && Number.isFinite(row.position));
    return { seasonId, rows };
  }

  getPlayerMatchStats() {
    return [];
  }

  async fetchPlayerMatchStats(sportmonksFixtureId) {
    if (!sportmonksFixtureId) return { rows: [], ratingsAvailable: false };

    const types = statTypeIds();
    const res = await smFetch(`/fixtures/${sportmonksFixtureId}`, {
      include: "lineups.details.type",
    });

    const lineups = res?.data?.lineups ?? [];
    const byPlayer = new Map();
    let sawRating = false;

    for (const row of lineups) {
      const pid = row.player_id;
      if (!pid) continue;
      if (!byPlayer.has(pid)) {
        byPlayer.set(pid, {
          provider_id: `sm-player-${pid}`,
          sportmonks_player_id: pid,
          goals: 0,
          assists: 0,
          minutes: 0,
          rating: null,
          yellow_cards: 0,
          red_cards: 0,
          clean_sheet: false,
        });
      }
      const stat = byPlayer.get(pid);
      for (const d of row.details ?? []) {
        const typeId = d.type?.id ?? d.type_id;
        const value = readStatValue(d);
        if (value == null) continue;
        if (typeId === types.goals) stat.goals += value;
        else if (typeId === types.assists) stat.assists += value;
        else if (typeId === types.minutes) stat.minutes += value;
        else if (typeId === types.rating) {
          stat.rating = value;
          sawRating = true;
        } else if (typeId === types.yellow) stat.yellow_cards += value;
        else if (typeId === types.red) stat.red_cards += value;
        else if (typeId === types.cleanSheet) stat.clean_sheet = value > 0;
      }
    }

    return { rows: [...byPlayer.values()], ratingsAvailable: sawRating };
  }

  async probePlan() {
    const report = { leagueIds: getSportmonksLeagueMap(), seasonIds: {}, endpoints: {} };
    const plId = report.leagueIds.pl;

    for (const league of ULTIMA_LEAGUES) {
      const id = report.leagueIds[league];
      if (!id) {
        report.endpoints[`leagues/${league}`] = "no-id";
        continue;
      }
      const r = await smFetchRaw(`/leagues/${id}`, { include: "currentSeason" });
      report.endpoints[`leagues/${league}?include=currentSeason`] = r.status;
      report.seasonIds[league] =
        r.json?.data?.currentseason?.id ??
        r.json?.data?.currentSeason?.id ??
        r.json?.data?.current_season_id ??
        null;
    }

    const from = "2026-09-19";
    const to = "2026-09-22";
    if (plId) {
      const fx = await smFetchRaw(`/fixtures/between/${from}/${to}`, {
        include: "participants;scores;state",
        filters: `fixtureLeagues:${plId}`,
      });
      report.endpoints["fixtures/between?include=participants;scores;state"] = fx.status;

      const finished = (fx.json?.data ?? []).find((f) => {
        const state = normalizeFixtureStatus(
          f.state?.short_name ?? f.state?.developer_name ?? f.state?.state,
        );
        return state === "FT";
      });
      if (finished?.id) {
        const stats = await smFetchRaw(`/fixtures/${finished.id}`, {
          include: "lineups.details.type",
        });
        report.endpoints["fixtures/{id}?include=lineups.details.type"] = stats.status;
      } else {
        report.endpoints["fixtures/{id}?include=lineups.details.type"] = "no-ft-in-window";
      }
    }

    const season = report.seasonIds.pl;
    if (season) {
      const standings = await smFetchRaw(`/standings/seasons/${season}`, {
        include: "participant;details.type",
      });
      report.endpoints["standings/seasons/{id}"] = standings.status;
      const tops = await smFetchRaw(`/topscorers/seasons/${season}`);
      report.endpoints["topscorers/seasons/{id}"] = tops.status;
      const side = await smFetchRaw(`/sidelined/seasons/${season}`);
      report.endpoints["sidelined/seasons/{id}"] = side.status;
    }

    return report;
  }

  getGameweekSample() {
    return null;
  }

  getRankings(league) {
    return this.getPlayers(league);
  }
}
