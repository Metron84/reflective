/**
 * Fetch current Premier League clubs from Sportmonks and merge into
 * crest-app/public/clubs.json. Remaps existing slugs; adds missing as Tier B.
 *
 *   node scripts/crest/import-premier-league.mjs
 *
 * Requires SPORTMONKS_API_KEY and SPORTMONKS_LEAGUE_ID_PL in .env.local
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal } from "./crest-env.mjs";
import { SPORTMONKS_BASE, sportmonksApiKey } from "./sportmonks-env.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvLocal(ROOT);
loadEnvLocal(join(ROOT, "../crest-app"));

const CLUBS_PATH =
  process.env.CREST_CLUBS_JSON ||
  join(ROOT, "../crest-app/public/clubs.json");

const ALIAS = {
  chelsea: "chelsea",
  "afc bournemouth": "bournemouth",
  bournemouth: "bournemouth",
  "brighton & hove albion": "brighton",
  "brighton and hove albion": "brighton",
  "nottingham forest": "nottingham-forest",
  "nottm forest": "nottingham-forest",
  "west ham united": "west-ham-united",
  "wolverhampton wanderers": "wolverhampton-wanderers",
  "wolves": "wolverhampton-wanderers",
  "tottenham hotspur": "tottenham-hotspur",
  "manchester city": "manchester-city",
  "manchester united": "manchester-united",
  "newcastle united": "newcastle-united",
  "crystal palace": "crystal-palace",
  "aston villa": "aston-villa",
  "leeds united": "leeds-united",
  "ipswich town": "ipswich-town",
  "leicester city": "leicester-city",
  "sheffield united": "sheffield-united",
  "nottingham-forest": "nottingham-forest",
};

const NEUTRAL_VECTOR = Array(12).fill(4);
const NEUTRAL_CONFIDENCE = Array(12).fill(1);

function slugify(name) {
  const n = String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return ALIAS[n.replace(/-/g, " ")] || ALIAS[n] || n;
}

async function smFetch(path, params = {}) {
  const key = sportmonksApiKey();
  if (!key) throw new Error("SPORTMONKS_API_KEY not set in .env.local");
  const url = new URL(`${SPORTMONKS_BASE}${path}`);
  url.searchParams.set("api_token", key);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Sportmonks ${path} ${res.status}`);
  }
  return body;
}

function venueName(team) {
  const v = team.venue || team.venue_id;
  if (v && typeof v === "object") {
    return v.name || v.official_name || null;
  }
  return null;
}

function cityName(team) {
  return team.city || team.venue?.city || null;
}

if (!existsSync(CLUBS_PATH)) {
  console.error(`Missing ${CLUBS_PATH}`);
  process.exit(1);
}

const leagueId = process.env.SPORTMONKS_LEAGUE_ID_PL?.trim() || "8";
const league = await smFetch(`/leagues/${leagueId}`, {
  include: "currentSeason",
});
const seasonId =
  league?.data?.currentseason?.id ??
  league?.data?.currentSeason?.id ??
  league?.data?.current_season_id;
if (!seasonId) {
  console.error("No current season on league", leagueId);
  process.exit(1);
}

const teamsRes = await smFetch(`/teams/seasons/${seasonId}`, {
  include: "venue",
});
const teams = teamsRes?.data ?? [];
if (!teams.length) {
  console.error("No teams for season", seasonId);
  process.exit(1);
}

const clubs = JSON.parse(readFileSync(CLUBS_PATH, "utf8"));
const bySlug = new Map(clubs.map((c) => [c.slug, c]));

const added = [];
const remapped = [];

for (const team of teams) {
  const slug = slugify(team.name);
  const stadium = venueName(team);
  const city = cityName(team);
  const existing = bySlug.get(slug);
  if (existing) {
    existing.competition = "Premier League";
    if (city && (!existing.city || existing.city === "Unknown")) {
      existing.city = city;
    }
    if (stadium) existing.stadiumName = stadium;
    remapped.push(slug);
    continue;
  }
  const row = {
    slug,
    name: team.name,
    city: city || "Unknown",
    country: "England",
    cluster: "england-north",
    tier: "B",
    competition: "Premier League",
    vector: NEUTRAL_VECTOR,
    confidence: NEUTRAL_CONFIDENCE,
    identity_summary:
      "SAMPLE placeholder. Cultural identity not yet scored for this club. Matching uses a neutral estimate only.",
    exclusion_clubs: [],
    badge_url: null,
    archetype: null,
    uae: null,
    trf_film_youtube_id: null,
    research_status: "draft",
    primary: "#0A111F",
    secondary: "#1a2438",
    stadiumName: stadium || "Home ground",
    skylineVariant: 4,
  };
  clubs.push(row);
  bySlug.set(slug, row);
  added.push(slug);
}

clubs.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(CLUBS_PATH, `${JSON.stringify(clubs, null, 2)}\n`);

console.log(`Season ${seasonId}: ${teams.length} PL clubs`);
console.log(`Remapped: ${remapped.join(", ") || "(none)"}`);
console.log(`Added: ${added.join(", ") || "(none)"}`);
console.log(`Wrote ${clubs.length} clubs → ${CLUBS_PATH}`);
