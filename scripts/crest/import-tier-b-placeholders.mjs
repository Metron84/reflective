/**
 * Generate neutral Tier B rows from data/tier-b/batches/*.json and upsert.
 * Vectors are all 4 / confidence 1 until Perplexity scoring replaces them.
 *
 *   node scripts/crest/import-tier-b-placeholders.mjs
 *   node scripts/crest/import-tier-b-placeholders.mjs --commit
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { supabaseFromEnv } from "./crest-env.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BATCH_DIR = join(ROOT, "data/tier-b/batches");
const TIER_A_PATH = join(ROOT, "data/tier-a/clubs.json");
const commit = process.argv.includes("--commit");

const NEUTRAL_VECTOR = Array(12).fill(4);
const NEUTRAL_CONFIDENCE = Array(12).fill(1);

const PLACEHOLDER_NOTE =
  "PLACEHOLDER Tier B. Neutral vector (4 on all dimensions). Replace with Perplexity batch scoring.";

const PLACEHOLDER_IDENTITY =
  "SAMPLE placeholder. Cultural identity not yet scored for this club. Matching uses a neutral estimate only.";

/** @type {Record<string, string>} */
const CLUSTER_BY_COMP = {
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

function tierASlugs() {
  if (!existsSync(TIER_A_PATH)) return new Set();
  return new Set(JSON.parse(readFileSync(TIER_A_PATH, "utf8")).map((c) => c.slug));
}

const skip = tierASlugs();
/** @type {object[]} */
const rows = [];
const seen = new Set();

for (const file of readdirSync(BATCH_DIR).filter((f) => /^\d{3}\.json$/.test(f))) {
  const batch = JSON.parse(readFileSync(join(BATCH_DIR, file), "utf8"));
  for (const c of batch) {
    const slug = c.slug?.trim();
    if (!slug || seen.has(slug) || skip.has(slug)) continue;
    seen.add(slug);
    const compSlug = c.competition_slug || "";
    const cluster = CLUSTER_BY_COMP[compSlug] || "midlands";
    rows.push({
      slug,
      name: c.name,
      common_name: c.common_name ?? c.name,
      city: c.city || null,
      country: c.country || null,
      founded: c.founded || null,
      cluster,
      vector: NEUTRAL_VECTOR,
      confidence: NEUTRAL_CONFIDENCE,
      identity_summary: PLACEHOLDER_IDENTITY,
      exclusion_clubs: [],
      competition: c.competition ?? null,
      vector_version: "1.1",
      research_status: "draft",
      source_quality_notes: PLACEHOLDER_NOTE,
      tier: "B",
    });
  }
}

console.log(`Tier B placeholders: ${rows.length} clubs (excluding ${skip.size} Tier A slugs).`);

if (!commit) {
  console.log("Dry run. Re-run with --commit to upsert.");
  process.exit(0);
}

const { url, key } = supabaseFromEnv(ROOT);
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CHUNK = 50;
for (let i = 0; i < rows.length; i += CHUNK) {
  const slice = rows.slice(i, i + CHUNK);
  const { error } = await supabase.from("crest_clubs").upsert(slice, {
    onConflict: "slug",
  });
  if (error) {
    console.error(`Supabase upsert failed at ${i}:`, error.message);
    process.exit(1);
  }
  console.log(`Upserted ${Math.min(i + CHUNK, rows.length)} / ${rows.length}`);
}
console.log(`Done. ${rows.length} Tier B placeholder clubs.`);
