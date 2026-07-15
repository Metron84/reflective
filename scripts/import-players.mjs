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
const { error } = await supabase.from("players").upsert(rows);
if (error) {
  console.error("Import failed:", error.message);
  process.exit(1);
}
console.log(`Imported ${rows.length} players.`);
