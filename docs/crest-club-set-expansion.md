# THE CREST: Club set expansion

Replaces Part 5 of `crest-club-database-brief.md`. Target moves from 60 clubs to roughly 220.

---

## THE PROBLEM WITH SCORING 220 CLUBS THE SAME WAY

- Full depth means twelve sourced judgments per club, which is around 2,600 evidence sentences.
- The sourcing does not exist evenly: Roma's supporter culture is documented in books, Clermont Foot's is not.
- More clubs also makes matching worse if they all carry equal weight, because near-identical mid-table vectors cluster and the top three becomes unstable noise.

So the database gets two tiers, and the confidence weighting you already built handles the rest automatically.

---

## TIER A: DEEP, ABOUT 60 CLUBS

The existing 60-club list from Part 5, unchanged.

- Full twelve-dimension scoring with evidence and source per non-neutral score.
- All editorial fields: rituals, narratives, rivalry, academy, stadium, UAE data.
- Confidence 2 or 3 on most dimensions.
- Supporter validated in Dubai before `research_status` moves to validated.
- Eligible as a primary match without restriction.

## TIER B: LIGHT, ABOUT 160 CLUBS

Everything else. Scored, but honestly scored as thinner.

- Twelve-dimension vector, confidence 1 or 2 throughout.
- Required fields only: slug, name, city, country, cluster, vector, confidence, identity_summary, exclusion_clubs, founded.
- No rituals, narratives or academy research required.
- Not supporter validated.
- `research_status` stays at `draft`.

The confidence factor drops a Tier B club's weight to 0.60, so it only surfaces when the fit is genuinely strong rather than because it happens to sit near the middle of every scale. That is the whole point: a Tier B club should win when it deserves to, not by accident.

---

## THE LEAGUES TO ADD

| Competition | Clubs |
|---|---|
| Serie A | 20 |
| LaLiga | 20 |
| Bundesliga | 18 |
| Ligue 1 | 18 |
| Serie B | 20 |
| LaLiga 2 | 22 |
| 2. Bundesliga | 18 |
| Ligue 2 | 18 |
| EFL Championship | 24 |
| EFL League One | 24 |

Roughly 200, less the clubs already in Tier A.

**Do not let me or anyone else type these lists from memory.** Promotion and relegation means any remembered list is wrong within a season, and a wrong club in the database is worse than a missing one. The club names come from the current season's league table, fetched at research time.

---

## STEP 1: GET THE CLUB LISTS

Run this in Perplexity once per competition.

```
List every club competing in [COMPETITION] in the current 2026/27 season.

Return valid JSON only, no preamble, no commentary, no markdown fences:

[{"name":"","common_name":"","city":"","country":"","founded":0}]

Use the official league table as your source and state the source URL in a final
object: {"source":"","as_of":""}. Do not include clubs relegated or promoted out
of this division. Do not include reserve or B teams unless they compete in this
division in their own right.
```

Then check the count against the table above before scoring anything.

League lists live in `data/leagues/<slug>.json`. Tier A dedup roster: `data/tier-a/clubs.json`.

```bash
node scripts/crest/validate-league-lists.mjs
node scripts/crest/prepare-tier-b-batches.mjs
node scripts/crest/print-batch-prompt.mjs 001
```

Scored batches → `data/tier-b/scored/`. Snapshot → `node scripts/crest/snapshot.mjs`. See `scripts/crest/README.md`.

---

## STEP 2: SCORE TIER B

Batches of twenty. Paste the Part 1 codebook and the three calibration anchors above this prompt every time, exactly as with Tier A.

```
You are scoring football clubs on a locked twelve dimension codebook. These are
lower-profile clubs, so the evidence base is thinner than for major clubs. Score
them honestly rather than confidently.

RULES
1. Score enduring cultural identity. Ignore the current season, manager, owner and
   league position entirely.
2. Treat 4 as the default. Move off 4 only where there is a documented reason.
   A club with no distinctive identity on a dimension should score 4, and most of
   these clubs will score 4 on most dimensions.
3. Confidence is capped at 2 for every score in this tier. Use 1 wherever the
   evidence is a single passing mention or an inference from the club's situation.
4. Do not invent supporter culture. If you cannot find evidence that a club has a
   distinctive ritual, rivalry or political character, that absence is data.
5. Divisional status is not an identity. Being in a second division does not make
   a club a suffering underdog, an outsider or a local institution. Score the club,
   not the league it is currently in.
6. Exclusion clubs: list the club's genuine derby rivals as slugs, lowercase and
   hyphenated. If there is no notable rivalry, return an empty array.

OUTPUT
Valid JSON only. One object per club:

{
  "slug": "",
  "name": "",
  "common_name": "",
  "city": "",
  "country": "",
  "founded": 0,
  "cluster": "",
  "vector": [0,0,0,0,0,0,0,0,0,0,0,0],
  "confidence": [0,0,0,0,0,0,0,0,0,0,0,0],
  "identity_summary": "",
  "exclusion_clubs": [],
  "vector_version": "1.1",
  "research_status": "draft",
  "source_quality_notes": ""
}

vector order is fixed: H1 H2 H3 H4 M1 M2 M3 M4 S1 S2 S3 S4.
identity_summary is one sentence, maximum 25 words, written for someone who has
never heard of this club.
cluster groups clubs that should not all appear in one result together. Use the
form country-region, for example italy-north, england-midlands, france-south.

CLUBS IN THIS BATCH
[paste twenty clubs here]
```

---

## STEP 3: THE SCHEMA CHANGE

One migration, before any Tier B data lands.

```
Build this patch, then stop.

1. Create the next free migration, crest_clubs_tier.sql, adding to crest_clubs:
   - tier text not null default 'B'
   - constraint restricting tier to 'A' or 'B'
   - index on (tier, research_status)

2. Set tier = 'A' for every club currently in the table.

3. Update scripts/crest/snapshot or the crest-app snapshot script to include tier
   in clubs.json.
```

---

## STEP 4: THE MATCHING RULE THAT STOPS THIS BACKFIRING

Add to `lib/select.js` in the crest-app repo, after Section 4 exists.

- A Tier B club may be the primary match only if its raw fit beats the best Tier A club by a clear margin, not by a rounding error.
- Suggested threshold: 0.02 on raw fit, tuned once there is real data.
- Below that margin, the Tier B club drops to a near neighbour, which is where an unexpected lower-division find is most compelling anyway.
- The result copy should name the division when the club is outside a top flight, because a user matched to Union Saint-Gilloise or Preston North End needs to know what they are being pointed at.

Without this rule the obscure clubs win on noise, because a vector of twelve 4s sits close to everybody.

---

## WHAT THIS COSTS YOU

- Around ten Perplexity runs to get the club lists.
- Around eight to ten scoring batches of twenty.
- No code changes beyond one migration and one threshold, because the weights and variance recompute themselves from whatever is loaded.

## WHAT IT BUYS YOU

- A user in Dubai who is genuinely a St Pauli or a Preston North End can be told so, which no other product does.
- Sportmonks covers the four first divisions on your current plan, so badges arrive free for 76 of these clubs, and the second divisions and EFL will need checking.
