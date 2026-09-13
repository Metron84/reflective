/**
 * Pull crest_clubs from Supabase into the Crest PWA bundle (clubs.json).
 *
 *   node scripts/crest/snapshot.mjs
 *   CREST_CLUBS_JSON=/path/to/clubs.json node scripts/crest/snapshot.mjs
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

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

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const dest =
  process.env.CREST_CLUBS_JSON ||
  join(ROOT, "../crest-app/public/clubs.json");

const SELECT =
  'slug,name,city,country,cluster,tier,competition,vector,confidence,identity_summary,exclusion_clubs,badge_url,archetype,uae,trf_film_youtube_id,research_status,primary,secondary,stadium_name,skyline_variant';

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase
  .from("crest_clubs")
  .select(SELECT)
  .order("name");

if (error) {
  console.error("Supabase error:", error.message);
  process.exit(1);
}

if (!data?.length) {
  console.error("No rows returned from crest_clubs.");
  process.exit(1);
}

const clubs = data.map((row) => {
  const { stadium_name, skyline_variant, ...rest } = row;
  return {
    ...rest,
    stadiumName: stadium_name ?? null,
    skylineVariant: skyline_variant ?? null,
  };
});

writeFileSync(dest, `${JSON.stringify(clubs, null, 2)}\n`);
console.log(`Snapshot: ${data.length} clubs → ${dest}`);
