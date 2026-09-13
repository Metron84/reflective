# Crest Tier B pipeline

Scripts for expanding the club set from ~60 (Tier A) to ~220 clubs by adding ~160 lightly-scored Tier B clubs from ten European second tiers / EFL competitions.

## Order of operations

1. Run the Step 1 Perplexity prompt once per competition and save each result as `data/leagues/<competition-slug>.json` (list of clubs + trailing `{"source","as_of"}` object). Ten files total: serie-a, laliga, bundesliga, ligue-1, serie-b, laliga-2, 2-bundesliga, ligue-2, efl-championship, efl-league-one.

2. `node scripts/crest/validate-league-lists.mjs`  
   Checks counts, trailer object, and Tier A dedup warnings.

3. `node scripts/crest/prepare-tier-b-batches.mjs`  
   Writes `data/tier-b/batches/001.json` … with stable **slug** per club and human-readable **competition**.

4. `node scripts/crest/print-batch-prompt.mjs 001`  
   Full Step 2 prompt for Perplexity. Save scored JSON to `data/tier-b/scored/001.json`.

5. `node scripts/crest/import-tier-b.mjs data/tier-b/scored/001.json`  
   Dry-run validation. Add `--commit` to upsert into Supabase (requires migration `0035_crest_clubs_tier.sql`).

6. `node scripts/crest/snapshot.mjs`  
   Writes `../crest-app/public/clubs.json` (or set `CREST_CLUBS_JSON`). Commit and push crest-app for Vercel.

### One-shot (Tier A + Tier B placeholders + PWA bundle)

- `node scripts/crest/import-all-clubs.mjs --commit`  
  Upserts into Supabase when `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and a rotated `SUPABASE_SERVICE_ROLE_KEY`, then snapshots and runs `crest-app` ground enrich. If the service role is missing, it builds `clubs.json` from `data/tier-a` + `data/tier-b/batches` instead (`build-clubs-local.mjs`).

- `node scripts/crest/import-tier-a.mjs --commit`  
- `node scripts/crest/import-tier-b-placeholders.mjs --commit`  
- `node scripts/crest/build-clubs-local.mjs` — no Supabase; same PWA shape as snapshot.

After any build, in **crest-app**: `npm run enrich:ground` (also run automatically by `import-all-clubs.mjs --commit`).

## Other scripts

- `enrich-sportmonks.mjs` — badges and factual fields (dry-run default).
- Tier A roster for dedup: `data/tier-a/clubs.json` (from sample anchors; expand to full 60).

## Notes

- Never hand-type a league list. If validation fails, re-run Step 1 Perplexity for that competition.
- Tier B confidence is capped at 2. A 3 in scored output is an error.
- Wrong club in the database is worse than a missing one: drop failed rows, do not guess.
