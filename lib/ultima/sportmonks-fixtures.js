/**
 * Sportmonks fixture reads shared by the gameweek builder script and the
 * league_open_at refresh. Read only. The key is passed in and never logged.
 */
const BASE = "https://api.sportmonks.com/v3/football";
export const SEASON_NAMES = ["2026/2027", "2026/27"];
const CHUNK_DAYS = 90;

export function leagueIdsFromEnv(env = process.env) {
  return {
    pl: env.SPORTMONKS_LEAGUE_ID_PL ?? "8",
    laliga: env.SPORTMONKS_LEAGUE_ID_LALIGA ?? "564",
    seriea: env.SPORTMONKS_LEAGUE_ID_SERIEA ?? "384",
    bundesliga: env.SPORTMONKS_LEAGUE_ID_BUNDESLIGA ?? "82",
    ligue1: env.SPORTMONKS_LEAGUE_ID_LIGUE1 ?? "301",
  };
}

export function addDays(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function makeSportmonks(key) {
  async function sm(path, params = {}) {
    const url = new URL(`${BASE}${path}`);
    url.searchParams.set("api_token", key);
    for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v));
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Sportmonks ${path} returned ${res.status}`);
    return res.json();
  }

  async function seasonIdFor(leagueId) {
    const json = await sm(`/leagues/${leagueId}`, { include: "seasons" });
    const season = (json?.data?.seasons ?? []).find((s) => SEASON_NAMES.includes(s.name));
    return season?.id ?? null;
  }

  /** Fixtures for one league and season between two YYYY-MM-DD dates (inclusive). */
  async function fetchLeagueFixtures({ league, leagueId, seasonId, from, to }) {
    const out = [];
    let start = from;
    while (start <= to) {
      const end = addDays(start, CHUNK_DAYS - 1);
      const chunkEnd = end < to ? end : to;
      for (let page = 1; ; page += 1) {
        const json = await sm(`/fixtures/between/${start}/${chunkEnd}`, {
          include: "state",
          filters: `fixtureLeagues:${leagueId}`,
          per_page: 50,
          page,
        });
        for (const f of json?.data ?? []) {
          if (f.season_id !== seasonId) continue;
          out.push({
            league,
            kickoff: new Date(`${f.starting_at.replace(" ", "T")}Z`).toISOString(),
            state: f.state?.developer_name ?? f.state?.name ?? null,
          });
        }
        if (!json?.pagination?.has_more) break;
      }
      start = addDays(chunkEnd, 1);
    }
    return out;
  }

  return { seasonIdFor, fetchLeagueFixtures };
}
