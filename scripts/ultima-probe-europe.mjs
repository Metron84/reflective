/**
 * One Sportmonks call per Europe-desk endpoint. Prints status codes only.
 * node --env-file=.env.local scripts/ultima-probe-europe.mjs
 */
const BASE = "https://api.sportmonks.com/v3/football";
const key = process.env.SPORTMONKS_API_KEY?.trim() ?? "";
const leagues = {
  pl: process.env.SPORTMONKS_LEAGUE_ID_PL,
  laliga: process.env.SPORTMONKS_LEAGUE_ID_LALIGA,
  seriea: process.env.SPORTMONKS_LEAGUE_ID_SERIEA,
  bundesliga: process.env.SPORTMONKS_LEAGUE_ID_BUNDESLIGA,
  ligue1: process.env.SPORTMONKS_LEAGUE_ID_LIGUE1,
};

if (!key) {
  console.log("0\tSPORTMONKS_API_KEY missing in this process");
  process.exit(1);
}

async function hit(label, path, params = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_token", key);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  console.log(`${res.status}\t${label}`);
  return { status: res.status, json };
}

const seasons = {};
for (const [slug, id] of Object.entries(leagues)) {
  if (!id) {
    console.log(`no-id\tleagues/${slug}?include=currentSeason`);
    continue;
  }
  const r = await hit(`leagues/${slug}?include=currentSeason`, `/leagues/${id}`, {
    include: "currentSeason",
  });
  seasons[slug] =
    r.json?.data?.currentseason?.id ??
    r.json?.data?.currentSeason?.id ??
    r.json?.data?.current_season_id ??
    null;
}

console.log("league_ids", JSON.stringify(leagues));
console.log("season_ids", JSON.stringify(seasons));

const plId = leagues.pl;
if (plId) {
  const fx = await hit(
    "fixtures/between?include=participants;scores;state",
    `/fixtures/between/2026-09-19/2026-09-22`,
    { include: "participants;scores;state", filters: `fixtureLeagues:${plId}` },
  );
  const finished = (fx.json?.data ?? []).find((f) => {
    const s = String(f.state?.short_name ?? f.state?.developer_name ?? f.state?.state ?? "").toUpperCase();
    return s === "FT" || s === "FINISHED";
  });
  if (finished?.id) {
    await hit(
      "fixtures/{id}?include=lineups.details.type",
      `/fixtures/${finished.id}`,
      { include: "lineups.details.type" },
    );
  } else {
    console.log("no-ft-in-window\tfixtures/{id}?include=lineups.details.type");
  }
}

if (seasons.pl) {
  await hit("standings/seasons/{id}", `/standings/seasons/${seasons.pl}`, {
    include: "participant;details.type",
  });
  await hit("topscorers/seasons/{id}", `/topscorers/seasons/${seasons.pl}`);
  await hit("sidelined/seasons/{id}", `/sidelined/seasons/${seasons.pl}`);
}
