// Upserts Reflections nominees from content/reflections/*.json
// Usage: export $(grep -v '^#' .env.local | xargs) && node scripts/seed-reflections-nominees.mjs [category-slug...]
// With no args, seeds all categories that have a JSON file in lib/reflections SEED_FILES.

import { readFileSync, existsSync } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const SEED_FILES = {
  "best-video": "content/reflections/best-video-nominees.json",
  "best-supporters-club": "content/reflections/best-supporters-club-nominees.json",
  "best-celebration": "content/reflections/best-celebration-nominees.json",
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const slugs = process.argv.slice(2);
const targets =
  slugs.length > 0
    ? slugs.filter((s) => SEED_FILES[s])
    : Object.keys(SEED_FILES);

if (targets.length === 0) {
  console.error("No matching category slugs. Known:", Object.keys(SEED_FILES).join(", "));
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

for (const slug of targets) {
  const rel = SEED_FILES[slug];
  const file = path.join(process.cwd(), rel);
  if (!existsSync(file)) {
    console.warn(`Skip ${slug}: missing ${rel}`);
    continue;
  }
  const rows = JSON.parse(readFileSync(file, "utf8"));
  const { error } = await supabase.from("nominees").upsert(rows, { onConflict: "id" });
  if (error) {
    console.error(`Seed failed for ${slug}:`, error.message);
    process.exit(1);
  }
  console.log(`Seeded ${rows.length} ${slug} nominees.`);
}
