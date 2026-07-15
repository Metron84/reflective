// Upserts Best Celebration nominees from content/reflections/best-celebration-nominees.json
// Usage: export $(grep -v '^#' .env.local | xargs) && node scripts/seed-best-celebration.mjs

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const rows = JSON.parse(
  readFileSync("content/reflections/best-celebration-nominees.json", "utf8")
);

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { error } = await supabase.from("nominees").upsert(rows, { onConflict: "id" });
if (error) {
  console.error("Seed failed:", error.message);
  process.exit(1);
}
console.log(`Seeded ${rows.length} Best Celebration nominees.`);
