/**
 * Validate Perplexity Tier B scoring output before Supabase insert.
 *
 *   node scripts/crest/import-tier-b.mjs path/to/scored.json
 *   node scripts/crest/import-tier-b.mjs path/to/scored.json --commit
 *
 * --commit writes rows with tier B via service role (requires .env.local).
 * Default is dry-run: validation report only.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

function loadTierASlugs() {
  const path = join(ROOT, "data/tier-a/clubs.json");
  if (!existsSync(path)) return new Set();
  return new Set(JSON.parse(readFileSync(path, "utf8")).map((c) => c.slug));
}

const TIER_A_SLUGS = loadTierASlugs();
const REPORT_DIR = join(__dirname, "reports");
const KIT_FAMILIES = new Set([
  "red",
  "blue",
  "white",
  "black",
  "purple",
  "yellow",
  "green",
  "orange",
  "pink",
  "brown",
  "grey",
  "claret",
]);

const inputPath = process.argv[2];
const commit = process.argv.includes("--commit");

if (!inputPath) {
  console.error("Usage: node scripts/crest/import-tier-b.mjs <scored.json> [--commit]");
  process.exit(1);
}

function loadEnvLocal() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const raw = JSON.parse(readFileSync(inputPath, "utf8"));
const clubs = Array.isArray(raw) ? raw : raw.clubs;
if (!Array.isArray(clubs)) {
  console.error("Expected JSON array or { clubs: [] }");
  process.exit(1);
}

const errors = [];
const warnings = [];
const rows = [];

for (const c of clubs) {
  const slug = c.slug?.trim();
  if (!slug) {
    errors.push(`${c.name ?? "?"}: missing slug`);
    continue;
  }
  if (TIER_A_SLUGS.has(slug)) {
    warnings.push(`${slug}: overlaps Tier A sample slug (skip or score as Tier A)`);
  }
  if (!Array.isArray(c.vector) || c.vector.length !== 12) {
    errors.push(`${slug}: vector must have 12 values`);
  }
  if (!Array.isArray(c.confidence) || c.confidence.length !== 12) {
    errors.push(`${slug}: confidence must have 12 values`);
  } else if (c.confidence.some((n) => n > 2)) {
    errors.push(`${slug}: Tier B confidence must be ≤ 2 on every dimension`);
  }
  if (c.research_status && c.research_status !== "draft") {
    warnings.push(`${slug}: research_status is ${c.research_status}, expected draft for Tier B`);
  }
  if (!c.cluster) {
    errors.push(`${slug}: missing cluster`);
  }
  if (!c.identity_summary) {
    errors.push(`${slug}: missing identity_summary`);
  }
  if (!KIT_FAMILIES.has(c.kit_family)) {
    errors.push(`${slug}: kit_family must be one of ${[...KIT_FAMILIES].join(", ")}`);
  }

  rows.push({
    slug,
    name: c.name,
    common_name: c.common_name ?? c.name,
    city: c.city ?? null,
    country: c.country ?? null,
    founded: c.founded ?? null,
    cluster: c.cluster,
    vector: c.vector,
    confidence: c.confidence,
    identity_summary: c.identity_summary,
    kit_family: c.kit_family,
    exclusion_clubs: c.exclusion_clubs ?? [],
    competition: c.competition ?? null,
    vector_version: c.vector_version ?? "1.1",
    research_status: "draft",
    source_quality_notes: c.source_quality_notes ?? null,
    tier: "B",
  });
}

mkdirSync(REPORT_DIR, { recursive: true });
const report = {
  file: inputPath,
  club_count: rows.length,
  errors,
  warnings,
  ok: errors.length === 0,
};
const reportPath = join(
  REPORT_DIR,
  `import-tier-b-${new Date().toISOString().slice(0, 10)}.json`,
);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Validated ${rows.length} clubs. Errors: ${errors.length}. Warnings: ${warnings.length}.`);
for (const e of errors) console.log(`  ERROR ${e}`);
for (const w of warnings) console.log(`  WARN  ${w}`);
console.log(`Report: ${reportPath}`);

if (errors.length) process.exit(1);

if (!commit) {
  console.log("\nDry run only. Re-run with --commit to upsert into crest_clubs.");
  process.exit(0);
}

loadEnvLocal();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error } = await supabase.from("crest_clubs").upsert(rows, { onConflict: "slug" });
if (error) {
  console.error("Supabase upsert failed:", error.message);
  process.exit(1);
}
console.log(`Upserted ${rows.length} Tier B clubs.`);
