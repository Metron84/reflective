# The Stand — Content Spec (SAMPLE foundation)

**Status:** Large SAMPLE story DB across all seeded leagues. Playable at `/stand`. Championship still blocked (0 seed rows).

---

## Scale (current)

| Metric | Count |
|--------|------:|
| Chapters | **231** |
| Questions | **3465** |
| Hand-authored | 3 (Fiorentina, Italy, Henry) |
| Auto SAMPLE | 228 |

### By lane

| Prefix | Lane | Chapters |
|--------|------|---------:|
| `pl` | Premier League | 43 |
| `sa` | Serie A | 40 |
| `ll` | La Liga | 35 |
| `bl` | Bundesliga | 32 |
| `l1` | Ligue 1 | 43 |
| `na` | Nations | **37** |
| `player` | Player | 1 |

**Nations:** Tier A = 3 chapters · Tier B = 2 · Tier C = 1 (21 nations). Championship ignored.

**Tier rules (clubs):** A = ch01–ch03 · B/C = ch01 · D = skipped until players DB grows.

---

## Commands

```bash
npm run build:stand-entities
npm run generate:stand-chapters          # clubs A/B/C all leagues
npm run generate:stand-nations           # nations A/B/C (multi-chapter)
npm run generate:stand-chapters -- --force-auto
npm run generate:stand-nations -- --force-auto
npm run validate:stand-all
```

---

## Composers

| Lane | Composer |
|------|----------|
| PL | Zadie Smith |
| Championship | Chaucer (**blocked**) |
| Serie A | Dante |
| La Liga | Cervantes |
| Bundesliga | Goethe |
| Ligue 1 | Albert Camus |
| Nations | Homer |

---

## Still open

- Championship seed
- More player packs
- Editorial pass on auto packs
- Supabase progress + tribe pulse

*Databases first. Product polish later.*
