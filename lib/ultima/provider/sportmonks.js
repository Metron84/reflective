import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import {
  SPORTMONKS_BASE,
  getSportmonksLeagueId,
  sportmonksApiKey,
  statTypeIds,
} from "@/lib/ultima/provider/sportmonks-config";

async function smFetch(path, params = {}) {
  const key = sportmonksApiKey();
  if (!key) throw new Error("SPORTMONKS_API_KEY not configured");

  const url = new URL(`${SPORTMONKS_BASE}${path}`);
  url.searchParams.set("api_token", key);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Sportmonks ${path} returned ${res.status}`);
  }

  return res.json();
}

function normalizeFixtureStatus(raw) {
  const value = String(raw ?? "scheduled").toLowerCase();
  if (["finished", "ft", "fulltime", "complete", "completed", "aet", "pen"].includes(value)) {
    return "finished";
  }
  if (["live", "inplay", "1st_half", "2nd_half", "ht", "break"].includes(value)) {
    return "live";
  }
  return "scheduled";
}

/** A full league campaign, used to turn minutes played into a reliability share. */
const SEASON_MINUTES = 38 * 90;

/** Match-level variance has no season-aggregate source, so everyone sits neutral. */
const NEUTRAL_CONSISTENCY = 0.3;

/** Squad endpoint pages; five leagues never approach this, it only stops a runaway loop. */
const MAX_TEAM_PAGES = 20;

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

/** Season totals for one player, or null when they did not feature. */
function readSeasonTotals(row, seasonId) {
  const types = statTypeIds();
  const blocks = (row.statistics ?? []).filter(
    (s) => !seasonId || s?.season_id === seasonId,
  );

  let goals = 0;
  let assists = 0;
  let minutes = 0;
  let appearances = 0;
  let rating = null;

  for (const block of blocks) {
    for (const detail of block.details ?? []) {
      const typeId = detail?.type_id ?? detail?.type?.id;
      const value = readStatValue(detail);
      if (value == null) continue;

      if (typeId === types.goals) goals += value;
      else if (typeId === types.assists) assists += value;
      else if (typeId === types.minutes) minutes += value;
      else if (typeId === types.appearances) appearances += value;
      else if (typeId === types.rating) rating = value;
    }
  }

  if (!appearances && !minutes && rating == null) return null;
  return { goals, assists, minutes, appearances, rating };
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
      const leagueRes = await smFetch(`/leagues/${leagueId}`, {
        include: "currentSeason;seasons",
      });
      const seasonId =
        leagueRes?.data?.currentseason?.id ??
        leagueRes?.data?.currentSeason?.id ??
        leagueRes?.data?.current_season_id;

      if (!seasonId) {
        return this.#fail(
          league,
          `League ${leagueId} returned no current season. Check the league ID.`,
        );
      }

      // Squads come from the season about to be played so clubs and transfers are
      // right. Ratings come from the last completed season, because a campaign a
      // matchday old has no statistics worth drafting on.
      const previous = pickPreviousSeason(leagueRes?.data?.seasons, seasonId);
      const statsSeasonId = previous?.id ?? seasonId;

      const teams = await this.#fetchSeasonSquads(seasonId, statsSeasonId);
      const clubStrength = await this.#fetchClubStrength(statsSeasonId);

      const players = [];
      for (const team of teams) {
        const club = team.name ?? "Unknown";
        const strength = clubStrength.get(team.id) ?? null;

        for (const entry of team.players ?? []) {
          const p = entry.player ?? entry;
          if (!p?.id) continue;

          const totals = readSeasonTotals(p, statsSeasonId);
          players.push(
            normalisePlayer(p, league, club, totals ? totalsToMetrics(totals) : null, strength),
          );
        }
      }

      if (!players.length) {
        return this.#fail(
          league,
          teams.length
            ? `${teams.length} clubs returned, none with squads. Your plan may not include squad data.`
            : `Season ${seasonId} returned no clubs.`,
        );
      }

      const rated = players.filter((p) => p.has_season_stats).length;
      this.#coverage.set(league, {
        rated,
        total: players.length,
        season: previous?.name ?? null,
      });

      fillGapsWithLeagueAverage(players);

      this.#reasons.delete(league);
      this.#playerCache.set(league, players);
      return players;
    } catch (err) {
      return this.#fail(league, err?.message ?? "Request failed.");
    }
  }

  /** Squads for a season with prior-season stats nested, paged and type filtered. */
  async #fetchSeasonSquads(seasonId, statsSeasonId) {
    const types = statTypeIds();
    const typeFilter = [
      types.goals,
      types.assists,
      types.rating,
      types.minutes,
      types.appearances,
    ].join(",");

    const teams = [];
    for (let page = 1; page <= MAX_TEAM_PAGES; page += 1) {
      const res = await smFetch(`/teams/seasons/${seasonId}`, {
        include: "players.player.statistics.details",
        filters: `playerStatisticSeasons:${statsSeasonId};playerStatisticDetailTypes:${typeFilter}`,
        per_page: 50,
        page,
      });

      teams.push(...(res?.data ?? []));
      if (!res?.pagination?.has_more) break;
    }

    return teams;
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

  async fetchFixtures(league, from, to) {
    const leagueId = getSportmonksLeagueId(league);
    if (!leagueId || !from || !to) return [];

    try {
      const fromDate = from.slice(0, 10);
      const toDate = to.slice(0, 10);
      const res = await smFetch(`/fixtures/between/${fromDate}/${toDate}`, {
        include: "participants",
        filters: `fixtureLeagues:${leagueId}`,
      });
      return (res?.data ?? []).map((f) => ({
        provider_id: `sm-fix-${f.id}`,
        league,
        kickoff: f.starting_at,
        status: normalizeFixtureStatus(f.state?.state ?? f.state?.developer_name),
        home_club: f.participants?.find((p) => p.meta?.location === "home")?.name,
        away_club: f.participants?.find((p) => p.meta?.location === "away")?.name,
        sportmonks_fixture_id: f.id,
      }));
    } catch {
      return [];
    }
  }

  getPlayerMatchStats(fixtureId) {
    return [];
  }

  async fetchPlayerMatchStats(sportmonksFixtureId) {
    if (!sportmonksFixtureId) return [];

    try {
      const types = statTypeIds();
      const res = await smFetch(`/fixtures/${sportmonksFixtureId}`, {
        include: "lineups.details.type",
      });

      const lineups = res?.data?.lineups ?? [];
      const byPlayer = new Map();

      for (const row of lineups) {
        const pid = row.player_id;
        if (!pid) continue;
        if (!byPlayer.has(pid)) {
          byPlayer.set(pid, {
            provider_id: `sm-player-${pid}`,
            sportmonks_player_id: pid,
            goals: 0,
            assists: 0,
            rating: null,
          });
        }
        const stat = byPlayer.get(pid);
        for (const d of row.details ?? []) {
          const typeId = d.type?.id ?? d.type_id;
          const value = Number(d.data?.value ?? d.value ?? 0);
          if (typeId === types.goals) stat.goals += value;
          if (typeId === types.assists) stat.assists += value;
          if (typeId === types.rating) stat.rating = value;
        }
      }

      return [...byPlayer.values()];
    } catch {
      return [];
    }
  }

  getGameweekSample() {
    return null;
  }

  getRankings(league) {
    return this.getPlayers(league);
  }
}
