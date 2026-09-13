/**
 * Build crest-app/public/clubs.json from repo data (no Supabase).
 * Use when service role is not in .env.local, or to preview the full set.
 *
 *   node scripts/crest/build-clubs-local.mjs
 *   CREST_CLUBS_JSON=/path/clubs.json node scripts/crest/build-clubs-local.mjs
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BATCH_DIR = join(ROOT, "data/tier-b/batches");
const SCORED_DIR = join(ROOT, "data/tier-b/scored");
const TIER_A_PATH = join(ROOT, "data/tier-a/clubs.json");

const NEUTRAL_VECTOR = Array(12).fill(4);
const NEUTRAL_CONFIDENCE = Array(12).fill(1);

const PLACEHOLDER_NOTE =
  "PLACEHOLDER Tier B. Neutral vector (4 on all dimensions). Replace with Perplexity batch scoring.";

const PLACEHOLDER_IDENTITY =
  "SAMPLE placeholder. Cultural identity not yet scored for this club. Matching uses a neutral estimate only.";

/** @type {Record<string, string>} */
const CLUSTER_BY_COMP = {
  "premier-league": "england-north",
  "serie-a": "italy-north",
  "serie-b": "italy-north",
  laliga: "catalan",
  "laliga-2": "catalan",
  bundesliga: "germany-red",
  "2-bundesliga": "germany-red",
  "ligue-1": "france-capital",
  "ligue-2": "france-south",
  "efl-championship": "midlands",
  "efl-league-one": "midlands",
};

/** @param {object} c */
function toPwaRow(c) {
  const {
    stadium_name,
    skyline_variant,
    stadiumName: sn,
    skylineVariant: sv,
    ...rest
  } = c;
  return {
    slug: rest.slug,
    name: rest.name,
    city: rest.city ?? null,
    country: rest.country ?? null,
    cluster: rest.cluster,
    tier: rest.tier ?? "A",
    competition: rest.competition ?? null,
    vector: rest.vector,
    confidence: rest.confidence,
    identity_summary: rest.identity_summary,
    kit_family: rest.kit_family ?? null,
    exclusion_clubs: rest.exclusion_clubs ?? [],
    badge_url: rest.badge_url ?? null,
    archetype: rest.archetype ?? null,
    uae: rest.uae ?? null,
    trf_film_youtube_id: rest.trf_film_youtube_id ?? null,
    research_status: rest.research_status ?? "sample",
    primary: rest.primary ?? null,
    secondary: rest.secondary ?? null,
    stadiumName: sn ?? stadium_name ?? null,
    skylineVariant: sv ?? skyline_variant ?? null,
  };
}

const tierA = JSON.parse(readFileSync(TIER_A_PATH, "utf8"));
const skip = new Set(tierA.map((c) => c.slug));
/** @type {object[]} */
const clubs = tierA.map((c) => toPwaRow({ ...c, tier: "A" }));

const seen = new Set(clubs.map((c) => c.slug));

const EXTRA_PL = join(ROOT, "data/tier-b/premier-league-2026-27.json");
if (existsSync(EXTRA_PL)) {
  for (const c of JSON.parse(readFileSync(EXTRA_PL, "utf8"))) {
    const slug = c.slug?.trim();
    if (!slug || seen.has(slug) || skip.has(slug)) continue;
    seen.add(slug);
    clubs.push(
      toPwaRow({
        slug,
        name: c.name,
        city: c.city || null,
        country: c.country || "England",
        cluster: c.cluster || "england-north",
        tier: "B",
        competition: "Premier League",
        vector: NEUTRAL_VECTOR,
        confidence: NEUTRAL_CONFIDENCE,
        identity_summary: PLACEHOLDER_IDENTITY,
        kit_family: c.kit_family ?? null,
        exclusion_clubs: [],
        research_status: "draft",
        source_quality_notes: PLACEHOLDER_NOTE,
      }),
    );
  }
}

for (const file of readdirSync(BATCH_DIR).filter((f) => /^\d{3}\.json$/.test(f))) {
  const batch = JSON.parse(readFileSync(join(BATCH_DIR, file), "utf8"));
  for (const c of batch) {
    const slug = c.slug?.trim();
    if (!slug || seen.has(slug) || skip.has(slug)) continue;
    seen.add(slug);
    const compSlug = c.competition_slug || "";
    const cluster = CLUSTER_BY_COMP[compSlug] || "midlands";
    clubs.push(
      toPwaRow({
        slug,
        name: c.name,
        city: c.city || null,
        country: c.country || null,
        cluster,
        tier: "B",
        competition: c.competition ?? null,
        vector: NEUTRAL_VECTOR,
        confidence: NEUTRAL_CONFIDENCE,
        identity_summary: PLACEHOLDER_IDENTITY,
        kit_family: c.kit_family ?? null,
        exclusion_clubs: [],
        research_status: "draft",
        source_quality_notes: PLACEHOLDER_NOTE,
      }),
    );
  }
}

if (existsSync(SCORED_DIR)) {
  for (const file of readdirSync(SCORED_DIR).filter((f) => /^\d{3}\.json$/.test(f))) {
    const raw = JSON.parse(readFileSync(join(SCORED_DIR, file), "utf8"));
    const scored = Array.isArray(raw) ? raw : raw.clubs;
    if (!Array.isArray(scored)) continue;
    for (const c of scored) {
      const slug = c.slug?.trim();
      if (!slug) continue;
      const i = clubs.findIndex((row) => row.slug === slug);
      if (i < 0) continue;
      clubs[i] = toPwaRow({
        ...clubs[i],
        ...c,
        tier: "B",
        research_status: c.research_status ?? "draft",
      });
    }
  }
}

const STADIUMS_PATH = join(ROOT, "scripts/crest/stadiums/stadiums.json");
if (existsSync(STADIUMS_PATH)) {
  const grounds = JSON.parse(readFileSync(STADIUMS_PATH, "utf8"));
  const bySlug = new Map(grounds.map((row) => [row.slug, row]));
  for (const club of clubs) {
    const ground = bySlug.get(club.slug);
    if (!ground?.stadiumName) continue;
    club.stadiumName = ground.stadiumName;
    if (ground.city) club.city = ground.city;
  }
}

clubs.sort((a, b) => a.name.localeCompare(b.name));

const dest =
  process.env.CREST_CLUBS_JSON ||
  join(ROOT, "../crest-app/public/clubs.json");

if (!existsSync(dirname(dest))) {
  console.error(`Destination directory missing: ${dirname(dest)}`);
  process.exit(1);
}

writeFileSync(dest, `${JSON.stringify(clubs, null, 2)}\n`);
const tierCounts = clubs.reduce((acc, c) => {
  acc[c.tier] = (acc[c.tier] || 0) + 1;
  return acc;
}, /** @type {Record<string, number>} */ ({}));
console.log(
  `Local build: ${clubs.length} clubs → ${dest}`,
  `(A: ${tierCounts.A ?? 0}, B: ${tierCounts.B ?? 0})`,
);
