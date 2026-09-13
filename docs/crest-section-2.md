# THE CREST: Section 2

Standing rules from `docs/crest-cursor-build-brief.md` still apply, including the Sportmonks read-only clarification.

---

## FIRST: SECTION 1 PATCH

Two gaps from the Section 1 report are worth closing before any data lands, because both get harder later.

```
Build the Section 1 patch, then stop.

1. Replace public/crest-sample-clubs.json with the updated file provided.
   exclusion_clubs now holds slugs, not display names. Two new fields are
   present: founding_context and academy_reputation.

2. Create supabase/migrations/0034_crest_clubs_patch.sql adding to crest_clubs:
   - founding_context text
   - academy_reputation jsonb default '{}'::jsonb

3. Regenerate supabase/seeds/crest_clubs_sample.sql from the updated JSON.
   Still idempotent, still on conflict (slug) do update, still research_status 'sample'.

4. Add a comment on the exclusion_clubs column stating it holds slugs that
   reference crest_clubs.slug, and that unmatched slugs are expected and ignored
   until the full 60-club set is seeded.

Do not add any column for cultural_neighbours or cultural_opposites. Those are
computed from vectors in Section 4.
```

Why the slug change matters: with display names, a mismatch of one character makes the exclusion filter fail silently, and the visible symptom is a user being shown Everton and Liverpool together. That is the one failure that would embarrass the product publicly.

---

## SECTION 2: SPORTMONKS ENRICHMENT

Paste this into Cursor in Agent mode.

```
Build Section 2 only, then stop.

Goal: a one-off server script that enriches crest_clubs with Sportmonks reference
data. No routes, no UI, no API handlers, no scheduled job.

1. File: scripts/crest/enrich-sportmonks.mjs
   Run with: node scripts/crest/enrich-sportmonks.mjs [--dry-run] [--slug=x] [--limit=n]
   Defaults to --dry-run. Writing requires an explicit --commit flag.

2. Reuse lib/ultima/provider/sportmonks.js read only for the token and base URL.
   If reuse would require editing anything under lib/ultima/, stop and say so.
   Do not duplicate the provider. A thin Crest-specific wrapper is fine.

3. Fields this script may write, and nothing else:
   - sportmonks_id
   - badge_url        (from image_path)
   - founded          (only if currently null)
   - stadium          (jsonb: name, capacity, city, from the venue include)
   - socials          (jsonb, from the socials include)
   - updated_at

4. Fields this script must never write:
   vector, confidence, evidence, identity_summary, football_identity, rituals,
   narratives, primary_rivalry, archetype, research_status, uae,
   trf_film_youtube_id, source_quality_notes, contested_notes.
   The vector is editorial. Nothing from a stats API may move it.

5. Matching clubs to Sportmonks teams:
   - Search by name, then score the candidates on name similarity plus founded year
     plus country.
   - Write sportmonks_id only when exactly one candidate is unambiguous.
   - Everything else goes to a review file, never guessed. Al Ain, Al Ahly and
     Athletic Club all have plausible wrong matches, so a wrong ID is worse than
     a null one.

6. Rivals:
   - Read the rivals include. Map each rival team back to a crest_clubs slug.
   - Append any new slug to exclusion_clubs. Never remove an editorial entry.
   - A rival that is not in crest_clubs is written to the review file, not the row.

7. Subscription gaps are expected. Clubs outside the plan get null sportmonks_id
   and a line in the review file. This is not an error and must not halt the run.
   Do not fall back to scraping or to any other source.

8. Rate limiting: Sportmonks allows 3000 requests per hour per entity. Batch the
   teams calls, use includes rather than separate round trips, and add a small
   delay between requests. Log the request count at the end.

9. Output: scripts/crest/reports/enrich-YYYY-MM-DD.md containing
   - clubs matched, with the Sportmonks ID and the name it matched
   - clubs left unmatched, with the candidates considered and why none was chosen
   - clubs outside the subscription
   - rivals found that are not yet in crest_clubs
   - total requests made

10. Run it with --dry-run first and paste the report. Do not use --commit until
    Melo approves the report.

Then stop and report: how many of the 24 matched cleanly, how many need manual
IDs, and which clubs fall outside the subscription.
```

---

## WHAT THIS SECTION IS REALLY FOR

The dry-run report answers the open question from the API conversation: how much of the 60-club set your current Sportmonks plan actually covers. If the Arab batch comes back empty, that is a one-off manual fill of six fields per club, not a reason to change the plan.

Section 3 does not depend on any of this, so the flow can be built in parallel if you would rather not wait.
