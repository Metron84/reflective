# THE CREST: Cursor Build Brief

For thereflectivefootball.com. Route is `/crest`. Feature flag is `CREST_ENABLED`.

---

## STANDING RULES (apply to every section)

- Stop at the end of each section and wait. Do not start the next one.
- Conventional commits, small diffs, one section per branch.
- Never touch anything under `lib/ultima/`, `app/ultima/`, `app/api/ultima/` or `components/ultima/`.
- Sportmonks calls are server only. The token stays in env. Service role never appears in code, commits or chat.
- Sportmonks reuse: you may import from `lib/ultima/provider/sportmonks.js` read only. You may not modify, move or refactor any file under `lib/ultima/`. If reuse would require changing that file, stop and say so rather than editing it.
- Migrations are written but never run against production without explicit approval.
- Any placeholder data is marked SAMPLE in the record itself, not just in a comment.
- Mobile first, then desktop, as one implementation rather than two.
- Copy uses no em-dashes. Sentence case. No "Thank You" or "Questions?" endings.
- Brand tokens: cream #F2EDE4, navy #0A111F, signal red #D8232A, Bodoni Moda display, Archivo UI.
- Every screen has a visible way back. Site law is NO DEAD ENDS.

---

## SECTION MAP

1. **Data layer.** Supabase `crest_clubs` table, migration, and seed from the sample JSON.
2. **Sportmonks enrichment.** One-off server script filling sportmonks_id, badge, founded, venue, rivals, socials.
3. **The flow.** `/crest` route, tap-only question screens, ported from the prototype.
4. **Scoring engine.** Variance weights, pillar weights, exclusions, diversification, percentile display.
5. **Result screen.** Live crest SVG, archetype, primary, neighbours, admire from afar.
6. **Routing and no dead ends.** Next fixture in GST, TRF film, UAE supporters club.
7. **Ship.** Flag, `/games` card, sitemap, PWA caching, signup wall.

Only Section 1 is authorised.

---

## SECTION 1: DATA LAYER

Paste this into Cursor in Agent mode.

```
Read docs/crest-club-database-brief.md and public/crest-sample-clubs.json first.

Build Section 1 only, then stop.

1. Create supabase/migrations/00XX_crest_clubs.sql using the next free migration
   number in that folder. Do not guess it, list the folder and take the next one.

2. Table crest_clubs:
   - id uuid primary key default gen_random_uuid()
   - slug text unique not null
   - name text not null
   - common_name text
   - city text
   - country text
   - founded int
   - nickname text
   - motto text
   - ownership_model text
   - cluster text not null            -- diversification key, e.g. england-north
   - vector smallint[12] not null     -- fixed order H1 H2 H3 H4 M1 M2 M3 M4 S1 S2 S3 S4
   - confidence smallint[12] not null default '{3,3,3,3,3,3,3,3,3,3,3,3}'
   - evidence jsonb default '{}'::jsonb
   - identity_summary text
   - football_identity text
   - rituals jsonb default '[]'::jsonb
   - narratives jsonb default '[]'::jsonb
   - stadium jsonb default '{}'::jsonb
   - primary_rivalry jsonb default '{}'::jsonb
   - exclusion_clubs text[] default '{}'
   - archetype text
   - sportmonks_id int
   - badge_url text
   - socials jsonb default '{}'::jsonb
   - uae jsonb default '{}'::jsonb     -- kickoff_window_gst, supporters_club, broadcast
   - trf_film_youtube_id text
   - vector_version text not null default '1.1'
   - research_status text not null default 'sample'   -- sample | draft | reviewed | validated
   - last_reviewed timestamptz
   - reviewed_by text[] default '{}'
   - source_quality_notes text
   - contested_notes text
   - created_at timestamptz default now()
   - updated_at timestamptz default now()

3. Constraints:
   - array_length(vector,1) = 12 and array_length(confidence,1) = 12
   - every vector element between 1 and 7, every confidence element between 1 and 3
   - research_status restricted to the four values above

4. RLS on. Anon gets select only. No anon insert, update or delete.
   Writes happen through the service role in server code only.

5. Seed: write supabase/seeds/crest_clubs_sample.sql from
   public/crest-sample-clubs.json. Every seeded row gets research_status 'sample'.
   The seed must be idempotent, using on conflict (slug) do update.

6. Add CREST_ENABLED to lib/config.js, default false, following the exact pattern
   used by STAND_ENABLED.

7. Do not create any route, component or API handler in this section.

Then stop, and report: the migration number you used, the row count in the seed,
and anything in the brief you could not model in the schema.
```

---

## FILES TO SEND CURSOR

Put these in the repo before running Section 1.

| File | Where it goes | Why |
|---|---|---|
| `crest-club-database-brief.md` | `docs/` | The codebook, matching logic and schema. The source of truth. |
| `crest-sample-clubs.json` | `public/` | The 24 SAMPLE club vectors to seed from. |
| `crest-prototype.html` | `docs/` | The working prototype. Reference for the flow and the crest SVG, not to be copied in wholesale. |

Cursor should also be pointed at these existing files, which it must follow rather than reinvent.

| Existing file | Why it matters |
|---|---|
| `lib/config.js` | The feature-flag pattern. CREST_ENABLED copies STAND_ENABLED exactly. |
| `supabase/migrations/` | Numbering and RLS conventions. Take the next free number. |
| `lib/ultima/server/` | The existing Sportmonks provider. Section 2 reuses it, never duplicates it. |
| `app/sw.js` and `next.config.mjs` | PWA caching rules. Section 7 extends these, does not replace them. |
| `components/home/` | Door and card patterns for the `/games` entry in Section 7. |

---

## WHAT SECTION 1 DELIBERATELY LEAVES OUT

- No Sportmonks calls yet, because the table has to exist before anything fills it.
- No scoring code, because the club vectors are still SAMPLE and would bake in wrong weights.
- No route, so nothing is reachable and nothing needs hiding.
