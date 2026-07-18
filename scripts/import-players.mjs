// Imports data/players_seed.json into the Supabase players table.
// Usage: node scripts/import-players.mjs
// Optional: node scripts/import-players.mjs path/to/clues_batch.json
//   merges clues_by_player_id into rows before upsert.
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const seed = JSON.parse(readFileSync("data/players_seed.json", "utf8"));
const batchPath = process.argv[2];
let clueBatch = {};
if (batchPath) {
  const batch = JSON.parse(readFileSync(batchPath, "utf8"));
  clueBatch = batch.clues_by_player_id ?? batch;
  console.log(`Merging clues from ${batchPath} (${Object.keys(clueBatch).length} players).`);
}

const rows = seed.players.map((p) => ({
  id: p.id,
  person_id: p.person_id,
  canonical: Boolean(p.canonical),
  name: p.name,
  category: p.category,
  league: p.league,
  clubs: p.clubs ?? [],
  nationality: p.nationality,
  position: p.position,
  birth_year: p.birth_year,
  shirt_number: p.shirt_number,
  era_start: p.era_start,
  era_end: p.era_end,
  world_cup_editions: p.world_cup_editions ?? [],
  aliases: p.aliases ?? [],
  clues: clueBatch[p.id] ?? p.clues ?? [],
}));

const supabase = createClient(url, key, { auth: { persistSession: false } });

const incomingIds = rows.map((r) => r.id);
const { data: existing, error: fetchErr } = await supabase
  .from("players")
  .select("id")
  .in("id", incomingIds);

if (fetchErr) {
  console.error("Pre-import fetch failed:", fetchErr.message);
  process.exit(1);
}

const existingSet = new Set((existing ?? []).map((r) => r.id));
const toInsert = rows.filter((r) => !existingSet.has(r.id)).length;
const toUpdate = rows.length - toInsert;

const { error } = await supabase.from("players").upsert(rows, { onConflict: "id" });
if (error) {
  console.error("Import failed:", error.message);
  process.exit(1);
}

const { count, error: countErr } = await supabase
  .from("players")
  .select("id", { count: "exact", head: true });

console.log(
  JSON.stringify(
    {
      ok: true,
      upserted: rows.length,
      inserted: toInsert,
      updated: toUpdate,
      tableTotal: countErr ? null : count,
    },
    null,
    2
  )
);
