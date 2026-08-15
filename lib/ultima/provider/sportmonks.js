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

function normalisePlayer(row, league, clubName) {
  const id = row.player_id ?? row.id;
  const name = row.display_name ?? row.name ?? row.common_name ?? "Unknown";
  return {
    provider_id: `sm-${league}-${id}`,
    name,
    club: clubName ?? row.team?.name ?? "Unknown",
    league,
    active: true,
    goals_rate: 0.2,
    assists_rate: 0.08,
    rating_avg: 7.0,
    rating_consistency: 0.3,
    minutes_reliability: 0.75,
    club_strength: 0.5,
    sportmonks_player_id: id,
  };
}

/**
 * Sportmonks adapter (v5). Requires league IDs in env per docs/ultima-provider-mapping.md
 */
export class SportmonksProvider {
  #playerCache = new Map();

  /** Why a league came back empty, so a failed sync can explain itself. */
  #reasons = new Map();

  #ready() {
    return Boolean(sportmonksApiKey());
  }

  #fail(league, reason) {
    this.#reasons.set(league, reason);
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
      const seasons = await smFetch(`/leagues/${leagueId}`, {
        include: "currentSeason",
      });
      const seasonId =
        seasons?.data?.currentseason?.id ??
        seasons?.data?.currentSeason?.id ??
        seasons?.data?.current_season_id;

      if (!seasonId) {
        return this.#fail(
          league,
          `League ${leagueId} returned no current season. Check the league ID.`,
        );
      }

      const teamsRes = await smFetch(`/teams/seasons/${seasonId}`, {
        include: "players.player",
      });

      const players = [];
      const teams = teamsRes?.data ?? [];
      for (const team of teams) {
        const club = team.name ?? "Unknown";
        const roster = team.players ?? [];
        for (const entry of roster) {
          const p = entry.player ?? entry;
          if (!p?.id) continue;
          players.push(normalisePlayer(p, league, club));
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

      this.#reasons.delete(league);
      this.#playerCache.set(league, players);
      return players;
    } catch (err) {
      return this.#fail(league, err?.message ?? "Request failed.");
    }
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
