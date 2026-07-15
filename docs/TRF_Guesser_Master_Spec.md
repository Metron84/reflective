# The Guesser — Master Specification v2
### The Reflective Football · July 2026 · Supersedes all prior Guesser instructions

## 0. North star

**Person-first (Option A) with the TRF editorial clue ladder as the soul.** Players guess a FOOTBALLER, never a database row. The clue ladder carries the documentary voice; the attribute grid provides Wordle-style deduction feedback. Every design decision serves a casual fan arriving from Instagram who has never seen a game like this.

---

## 1. Concept

One player per day per mode. Six guesses. Five graded clues. Attribute tiles grade every guess. Midnight GST (UTC+4) rotation, per mode.

**Modes:** Classic (mixed pool, the free anonymous daily) + six member modes: World Cup Legends, Premier League, La Liga, Serie A, Bundesliga, Ligue 1. Each mode has its own daily puzzle and its own streak.

---

## 2. Data model (person-first)

- Every seed row gains `person_id` (shared across all rows of the same human) and `canonical` (boolean; exactly one canonical row per person — their best-known era, e.g. Messi = Barcelona / La Liga).
- **Matching, suggestions, solve condition, and already-guessed dedupe all operate on `person_id`.** One person = one suggestion card = one guess spent, regardless of how many rows they have.
- Classic mode: tiles compare the CANONICAL rows of guess and answer. Mode boards: compare that mode's rows.
- Classic answer pool: only persons whose canonical row has league data (prevents dead League columns on the answer side). All persons remain guessable.
- Clues live on the PERSON (one ladder per person, not per row): `clues` = array of 5 strings, hardest first.
- Seed file: `data/players_seed.json` (person-model version supplied by Melo/Claude). Import script upserts by id.

## 3. Guess input (forgiving, no ritual)

- Matching is case- and diacritic-insensitive across: full name, surname, name tokens, and the `aliases` array. "messi" → Lionel Messi; "cr7" → Cristiano Ronaldo; "ozil" matches Özil.
- If input resolves to exactly ONE person: Enter or the Guess button submits directly. No selection step.
- If ambiguous across distinct persons ("ronaldo"): styled disambiguation panel — navy cards, name + context line (nationality · era). Never a native <select>/dropdown.
- No match: friendly 422 nudge toward the suggestion list.
- Suggestion panel: styled to the board, keyboard navigable, comfortable mobile tap targets, one card per person.

## 4. The clue ladder (the editorial layer)

Five clues per person, graded HARDEST (1) to EASIEST (5):
1. **The Opening** — cryptic, cinematic title card. Auto-visible before any guess. Bodoni, quiet, labeled "The Opening".
2. **Identity** — nationality/position/era archetype, still broad.
3. **Career** — the club journey in famous shapes.
4. **The Moment** — the scene everyone remembers.
5. **The Giveaway** — near-certain: honours, initials, the wink.

Mechanics:
- Clues 2–5 render as labeled chips: Identity · Career · The Moment · The Giveaway.
- One chip UNLOCKS after each wrong guess (after guess 1 → clue 2 available … after guess 4 → clue 5). Locked chips are dimmed.
- Unlocked ≠ revealed: the player TAPS to read. Reveals are optional and tracked server-side with the play.
- Copy: "Wrong guesses unlock clue chips — tap one to read it."
- SAMPLE clues stay clearly marked until the authored set (TRF voice) is dropped in; authored clues must match their grade labels.

## 5. The feedback grid

- Six labeled columns: **Nation · League · Club · Position · Born · Shirt**. Each guess renders a row of six tiles; up to six rows build the board.
- Tile colors are the UNIVERSAL game language, not brand colors: **green = correct, amber = close, deep navy = wrong**. Not-recorded renders navy with a dash.
- Close semantics per column: Nation = same confederation; Position = adjacent line (MF↔FW, MF↔DF; never GK↔outfield); Born = within 5 years; Shirt = within 2. League/Club: exact or wrong only.
- Directional arrows on numeric tiles: Born and Shirt show ↑ / ↓ pointing toward the answer's value. Direction must read intuitively; verify in test.
- Tiles flip sequentially left→right on each guess. Respect prefers-reduced-motion.
- **Every tile is tappable/hoverable with a plain-sentence tooltip:** "1987 ↓" → "The player we're looking for was born before 1987." Dash → "Not recorded for this player." Amber Nation → "Different country, same confederation." This is the primary symbol-literacy mechanism.
- Mobile: six-tile row fits a 380px viewport — compact tiles, abbreviated headers, no horizontal scroll.

## 6. How to Play (three-layer explainer)

1. Collapsible panel, expanded on a player's first-ever visit.
2. Plain-language rules + color legend IN SENTENCES, including per-column arrow logic in words and the line: "Close means something different per column — tap any tile to see exactly what it's telling you."
3. **Worked example mini-row**, actually rendered: "You guessed Kaká — the answer was Ronaldinho," each of the six tiles annotated in plain sentences. Fictional example is fine; it teaches logic, not today's answer.
4. One line explaining the four share symbols.

## 7. Game over

- **Win:** celebration state, share card, then the funnel (section 8).
- **Loss:** THE ANSWER IS REVEALED — delivered server-side only within the game-over response, never earlier, never derivable before it. ("A new player arrives at midnight GST" accompanies, does not replace, the reveal.)
- Repeat play after completion: 409, done for today in that mode.

## 8. Share card + funnel (the growth loops)

- Share string: `The Guesser #N (Mode) 4/6 · 2 clues` (omit clue clause when zero: `· no clues`). No em-dashes.
- Emoji grid: 🟩🟨⬛⬜ (⬜ = not recorded). Native share sheet on mobile + one-tap copy. Site URL included.
- **Play-next-round funnel:** game-over primary CTA = "Play the next board". Members → next unplayed mode. Anonymous → signup popup with BOTH hooks: "Six more boards today, and your streak saved for tomorrow." Secondary actions: share, then The Reflections / films paths (NO DEAD ENDS).
- `/guesser` honors `?mode=` for all seven modes: locked modes render the board shell + signup popup — never a hardcoded Classic, never a dead link.

## 9. Security (airtight rules)

- The answer NEVER reaches the client before game over. No answer, no flagged candidates, nothing derivable in payloads or page source. `person_id` must not leak the answer's identity in any pre-game-over payload.
- Guess checking server-side. Puzzles table: RLS, zero client read. Daily selection: deterministic GST-date hash with `puzzles` table override for curated days.
- Anonymous state: signed httpOnly cookie, day-scoped, UX-convenience only. Completed plays recorded to `plays` (with clue-reveal count). Account state server-side (Phase 4).
- Autocomplete name list shipping to client is accepted for v1; server-side autocomplete is backlog as the pool grows.
- Re-run the full no-leak audit after the person-model change.

## 10. Copy rules

- TRF voice everywhere, including errors. No em-dashes anywhere. Fans are protagonists.
- Docs drift resolved in favor of shipped behavior: "birth year" (not age), share format with mode + clue count. Update /docs spec copy to match this document.

## 11. Acceptance tests (all must pass before commit)

1. Type "messi" + Enter → submits Lionel Messi directly, one guess spent.
2. Type "ronaldo" → disambiguation with exactly two person cards; picking one submits.
3. Guess a person once → any of their eras is rejected as already guessed.
4. Classic day where answer is a WC-legend person: League column on the answer side is never dead (pool rule).
5. Wrong guess → next chip visibly unlocks; tapping reveals; reveal count appears in share string.
6. Loss → answer revealed in game-over response only; pre-game-over payloads audited clean.
7. Tap every tile type (green/amber/navy/dash/arrows) → plain-sentence tooltip, desktop + mobile.
8. All 6 guesses on a 380px viewport: no horizontal scroll.
9. `?mode=la_liga` anonymous → board shell + signup popup, functioning.
10. Share string format exact, emoji grid uses all four symbols correctly, no em-dash anywhere.
