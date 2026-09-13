/**
 * Upsert Tier A clubs from data/tier-a/clubs.json
 *
 *   node scripts/crest/import-tier-a.mjs
 *   node scripts/crest/import-tier-a.mjs --commit
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { supabaseFromEnv } from "./crest-env.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const commit = process.argv.includes("--commit");
const clubs = JSON.parse(
  readFileSync(join(ROOT, "data/tier-a/clubs.json"), "utf8"),
);

const rows = clubs.map((c) => ({
  slug: c.slug,
  name: c.name,
  common_name: c.common_name ?? c.name,
  city: c.city ?? null,
  country: c.country ?? null,
  founded: c.founded ?? null,
  cluster: c.cluster,
  vector: c.vector,
  confidence: c.confidence,
  identity_summary: c.identity_summary,
  exclusion_clubs: c.exclusion_clubs ?? [],
  founding_context: c.founding_context ?? null,
  academy_reputation: c.academy_reputation ?? {},
  vector_version: c.vector_version ?? "1.1",
  research_status: c.research_status ?? "sample",
  source_quality_notes: c.source_quality_notes ?? null,
  tier: "A",
  competition: c.competition ?? null,
}));

console.log(`Tier A: ${rows.length} clubs ready.`);

if (!commit) {
  console.log("Dry run. Re-run with --commit to upsert.");
  process.exit(0);
}

const { url, key } = supabaseFromEnv(ROOT);
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error } = await supabase.from("crest_clubs").upsert(rows, {
  onConflict: "slug",
});
if (error) {
  console.error("Supabase upsert failed:", error.message);
  process.exit(1);
}
console.log(`Upserted ${rows.length} Tier A clubs.`);
