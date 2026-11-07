# THE CREST — Panel Lock (source of truth)

Where code and this file disagree, **this file wins**.

Assembled from the Nov 2026 panel pass: math, geometry, voice, share card, questions, and seven remaining layers.

## Routes

- `/crest` — landing
- `/crest/play` — panel Crest (`CrestApp`)
- `/crest/swipe` — Find Your FC swipe (legacy)

## Core math

- `similarity_d = 1 - |u_d - c_d| / 6`
- `w_d = pillar_weight_d × variance_weight_d × confidence_factor_d`
- `raw_fit = sum(w × sim) / sum(w)`
- `display = 60 + (raw - lo) / (hi - lo) × 37` (top three only, floor 60)
- Confidence: 3→1.00, 2→0.80, 1→0.60
- No non-linear similarity, perfect-match bonus, or interaction terms
- Contested dimensions: confidence capped at 2

## Geometry

ViewBox 280×280. Centre (140,140). Radii 26 / 72 / 118. Linear spoke map. Construction: outer guide → inner guide → red disc r=26 → twelve hairline spokes. No filled polygon.

## Voice

Second person, present tense, max three sentences for core reading, recognition before club. Twelve locked archetype readings in `the-crest/lib/archetype.js`.

## Share card

1080×1920 cream. Crest 640, archetype, reading, club, reason, domain footer. No percentage / neighbours / admire.

## Questions

Twelve five-tap questions + pillar. Map 1 · 2.5 · 4 · 5.5 · 7. Copy in `the-crest/lib/quiz-content.js`.

## Routing

Film → UAE supporters → Dubai-window fixture. Skip missing silently. Never suggest leaving a club.
