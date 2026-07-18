// Generates batched UPSERT SQL for Supabase SQL Editor from data/players_seed.json
// Usage: node scripts/generate-players-import-sql.mjs
// Output: supabase/seed/players_import/players_batch_01.sql …

import { readFileSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

const BATCH_SIZE = 80;
const OUT_DIR = path.join("supabase", "seed", "players_import");

function sqlStr(value) {
  if (value == null) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlTextArray(arr) {
  if (!arr?.length) return "array[]::text[]";
  return `array[${arr.map((v) => sqlStr(v)).join(", ")}]`;
}

function sqlIntArray(arr) {
  if (!arr?.length) return "array[]::integer[]";
  return `array[${arr.map((n) => Number(n)).join(", ")}]::integer[]`;
}

function rowToValues(p) {
  return `(
  ${sqlStr(p.id)},
  ${sqlStr(p.person_id)},
  ${p.canonical ? "true" : "false"},
  ${sqlStr(p.name)},
  ${sqlStr(p.category)},
  ${p.league != null ? sqlStr(p.league) : "null"},
  ${sqlTextArray(p.clubs)},
  ${sqlStr(p.nationality)},
  ${sqlStr(p.position)},
  ${Number(p.birth_year)},
  ${p.shirt_number != null ? Number(p.shirt_number) : "null"},
  ${p.era_start != null ? Number(p.era_start) : "null"},
  ${p.era_end != null ? Number(p.era_end) : "null"},
  ${sqlIntArray(p.world_cup_editions)},
  ${sqlTextArray(p.aliases)},
  ${sqlTextArray(p.clues)}
)`;
}

const UPSERT_TAIL = `
on conflict (id) do update set
  person_id = excluded.person_id,
  canonical = excluded.canonical,
  name = excluded.name,
  category = excluded.category,
  league = excluded.league,
  clubs = excluded.clubs,
  nationality = excluded.nationality,
  position = excluded.position,
  birth_year = excluded.birth_year,
  shirt_number = excluded.shirt_number,
  era_start = excluded.era_start,
  era_end = excluded.era_end,
  world_cup_editions = excluded.world_cup_editions,
  aliases = excluded.aliases,
  clues = excluded.clues;
`;

const INSERT_HEAD = `insert into public.players (
  id, person_id, canonical, name, category, league, clubs,
  nationality, position, birth_year, shirt_number, era_start, era_end,
  world_cup_editions, aliases, clues
) values
`;

const seed = JSON.parse(readFileSync("data/players_seed.json", "utf8"));
const players = seed.players;

mkdirSync(OUT_DIR, { recursive: true });

const batchCount = Math.ceil(players.length / BATCH_SIZE);
const manifest = [];

for (let b = 0; b < batchCount; b++) {
  const slice = players.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
  const num = String(b + 1).padStart(2, "0");
  const filename = `players_batch_${num}.sql`;
  const header = `-- Batch ${b + 1}/${batchCount}: rows ${b * BATCH_SIZE + 1}-${b * BATCH_SIZE + slice.length} of ${players.length}
-- Paste into Supabase SQL Editor and Run (in order 01 → ${String(batchCount).padStart(2, "0")})
`;

  const body =
    INSERT_HEAD +
    slice.map((p) => rowToValues(p)).join(",\n") +
    UPSERT_TAIL;

  const verify = `-- Verify this batch: select count(*) from public.players; -- expect ${Math.min((b + 1) * BATCH_SIZE, players.length)} cumulative after all batches through ${num}
`;

  writeFileSync(path.join(OUT_DIR, filename), header + body + "\n" + verify);
  manifest.push({ file: filename, rows: slice.length });
}

writeFileSync(
  path.join(OUT_DIR, "README.md"),
  `# Players import SQL (407 rows)

Generated from \`data/players_seed.json\`. Run in Supabase SQL Editor **in order** after the Guesser schema script.

| File | Rows |
|------|------|
${manifest.map((m) => `| \`${m.file}\` | ${m.rows} |`).join("\n")}

**Total:** ${players.length} rows

After all batches:

\`\`\`sql
select count(*) from public.players;
select category, count(*) from public.players group by category order by category;
\`\`\`

Expected: world_cup 90, premier_league 100, la_liga 55, serie_a 55, bundesliga 52, ligue_1 55.
`
);

console.log(`Wrote ${batchCount} batches (${players.length} rows) to ${OUT_DIR}/`);
