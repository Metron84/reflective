# THE CREST: Section 4, scoring and result

All client side. No network calls. Everything below runs against the committed `public/clubs.json`.

Reference: `docs/crest-club-database-brief.md` Part 6 is the source of truth for the maths. Where this prompt and that document disagree, the document wins.

---

## SECTION 4 PROMPT

```
Build Section 4 only, then stop.

1. lib/scoring.js, pure functions, no React, unit testable.

   Dimension order is fixed everywhere: H1 H2 H3 H4 M1 M2 M3 M4 S1 S2 S3 S4.

   varianceWeights(clubs)
     - standard deviation of each dimension across the loaded club set
     - normalised so the mean weight is 1
     - computed once at module load from clubs.json, not per user

   weightFor(dimension, pillarWeights, clubConfidence)
     - pillarWeight / 4, times varianceWeight, times confidence factor
     - confidence factor: 3 gives 1.00, 2 gives 0.80, 1 gives 0.60
     - confidence is per club per dimension, read from the club's confidence array

   rawFit(userVector, club, pillarWeights)
     - similarity per dimension is 1 - abs(user - club) / 6
     - weighted mean across all twelve, normalised by the sum of the weights

   rank(userVector, clubs, pillarWeights)
     - rawFit for every club, sorted descending

   displayPercent(raw, lowest, highest)
     - never show raw fit, it clusters around 80 and reads as fake
     - scale across that user's own distribution: 60 + ((raw - lo) / (hi - lo)) * 37
     - round to a whole number, floor at 60

2. lib/select.js, the routing rules.

   - Remove every club the user said they already support.
   - Primary is the highest ranked club that remains.
   - Build the excluded set from the primary's exclusion_clubs, by slug.
   - Two near neighbours: highest ranked remaining clubs that are not excluded and
     do not share a cluster with an already chosen club.
   - Each chosen club adds its own exclusion_clubs to the excluded set.
   - Admire from afar: highest value of Mind pillar fit minus the lower of Heart
     and Soul pillar fit, from clubs not already shown.
   - Reason line for each club: the two dimensions with the smallest weighted gap,
     expressed as the pole the club sits on, in plain words.

   Edge cases, all must be handled and none may throw:
   - fewer than three eligible clubs after filtering
   - the user excluded everything
   - two clubs with an identical raw fit, broken deterministically by slug
   - a club whose exclusion_clubs reference a slug not in the set, which is ignored

3. lib/archetype.js
   - The twelve archetypes and their signature vectors, from the prototype.
   - Nearest by squared distance to the user vector.
   - Returns name and reading.

4. components/Crest.jsx
   - The twelve spoke SVG from the prototype, drawn from the user vector.
   - Radius runs from 26 to 118 at a 280 viewBox, red dot at centre, hairline
     spokes and two guide circles.
   - Accessible label describing it as the user's football identity crest.

5. The result screen, in this order:
   - The crest
   - Archetype name, then the reading
   - Your club: name, identity summary, percentage
   - Near neighbours: two clubs, same treatment
   - Admire from afar: one club, with a line explaining the respect and the clash
   - Next: what to do now
   - The SAMPLE notice, which stays until research_status is validated for the
     clubs shown

   Never lead with the number. The archetype and the reasoning carry the result.

6. Guardrail copy, non-negotiable:
   - Never suggest the user leave a club they already support.
   - Frame results as a second club, an affinity club or a club to explore.
   - Show the reason for every recommendation. No unexplained percentages.

7. Routing, with graceful absence:
   - If the club has trf_film_youtube_id, link it as a film to watch.
   - If uae.supporters_club exists, show it as a group to join.
   - If neither exists, show a single link back to The Reflective Football rather
     than an empty block. No dead ends.

8. The share card:
   - Render a 1080x1920 PNG on a canvas: cream ground, the crest, the archetype in
     Bodoni Moda, the primary club, and thereflectivefootball.com at the foot.
   - Web Share API with the file where supported, download fallback otherwise.
   - This is the growth mechanic, so it must look finished, not like a screenshot.

9. Trigger the install prompt after the result renders, once per device, using the
   existing crest-install-prompt-seen key.

10. Tests: a small test file asserting that a vector identical to a club returns
    that club first, that an excluded club never appears, that derby rivals never
    appear together, and that display percentages never fall below 60.

Then stop and report: the top three results for an all-7 vector, an all-1 vector,
and a vector matching Everton exactly.
```

---

## THE THREE TEST VECTORS AND WHAT THEY SHOULD RETURN

Use these to sanity check before you look at anything else.

| Vector | Expected behaviour |
|---|---|
| All 7 | Should land on St Pauli, Roma or Athletic Club. If it returns Real Madrid, the direction of a scale is reversed somewhere. |
| All 1 | Should land on Real Madrid, Bayern Munich or Al Hilal. |
| Everton's exact vector | Everton first, and Liverpool must not appear in the near neighbours. If it does, the exclusion filter is not reading slugs. |

That third one is the whole exclusion system in a single check.

---

## AFTER SECTION 4

The product is complete and testable end to end on sample data. Then:

- Run it on Ferris, who supports Liverpool through Salah. If it returns Liverpool, the model has learned nothing.
- Then thirty people from the venue rounds, with three questions after each result.
- Then replace the sample rows with the researched batches, which changes nothing in the code because the weights recompute themselves.
