# The Reflective Football — Website v1 Build Spec
### For Claude Code · thereflectivefootball.com · July 2026

---

## 1. Purpose & Scope

**v1 ships three things:** the Films archive, The Reflections awards with public voting, and The Guesser daily game with a TRF account system. No We Are Football section yet (unannounced — nothing on the site should reference it). Partner pages, club/venue SEO landing pages, fan story portal: all v1.5+.

**Primary conversion goal:** turn anonymous visitors into free TRF accounts via two hooks — The Guesser (play again tomorrow = account) and The Reflections (see live results = account).

**Deadline pressure:** The Reflections voting is time-sensitive (tournament ended July 8). Build order below reflects this: Reflections page and Guesser first, Films archive immediately behind, polish last.

---

## 2. Stack

- **Framework:** Next.js (App Router) — server components + API routes give us the server-side game logic we need
- **Hosting:** Vercel (existing TRF account)
- **Database + Auth:** Supabase — Postgres + Auth (Google one-tap + email magic link, no passwords)
- **Styling:** Tailwind. Consult the frontend-design skill for aesthetic direction — the site must look like TRF films feel: dark, cinematic, footage-led. NOT a template with a logo.
- **Video:** YouTube embeds (lite-youtube-embed or equivalent facade for performance)
- **Analytics:** Vercel Analytics + a simple events table in Supabase (votes, plays, signups, shares)

## 3. Domain & DNS

Domain: **thereflectivefootball.com**, registered at weboasis.ae.
In the weboasis DNS panel:
- `A` record: `@` → `76.76.21.21` (Vercel)
- `CNAME` record: `www` → `cname.vercel-dns.com`
Then add the domain in Vercel project settings. Verify www → apex redirect. HTTPS is automatic.

---

## 4. Sitemap (v1)

```
/                     Home
/films                Films archive
/films/[slug]         Individual film page
/reflections          The Reflections — 8 categories, nominees, voting
/guesser              The Guesser daily game
/account              Streak, stats, vote history (auth required)
/about                Short mission page + contact
```

Header nav: Films · The Reflections · The Guesser · (Sign in / avatar)
Footer: social links (YouTube @TheReflectiveFootball, Instagram @thereflectivefootball), about, contact, privacy.

---

## 5. Design Direction

- Dark cinematic base. Footage is the design: hero sections use stills/loops from TRF films, not stock.
- Typography: one strong display face for titles, clean grotesque for body. Elevated, editorial — documentary title cards, not sports-blog.
- Brand accent: derive from the TRF identity (navy/red/white per the investor one-pager); confirm final tokens with Melo before building components.
- Motion: subtle. Fade-ups on scroll, no gimmicks. The films provide the drama.
- Mobile-first — Instagram is the biggest traffic source, so most visitors arrive on phones.

---

## 6. The Guesser — Game Spec

**Authoritative spec:** `docs/TRF_Guesser_Master_Spec.md` (person-first model, clue ladder, share format, acceptance tests). This section is a summary only.

**Concept:** Wordle-for-football with a TRF editorial clue ladder. One footballer per day per mode. Guess from attribute feedback (nationality, league, club, position, birth year, shirt number: correct / close / wrong).

### Airtight rules (non-negotiable architecture)
1. **The answer NEVER ships to the client before game over.** Guesses are POSTed to a server route; the server compares against the day's answer and returns only feedback. No answer, no flagged candidates, nothing derivable in payloads or page source before game over.
2. **All meaningful state is server-side, keyed to the account** (Phase 4). Anonymous play uses a signed day-scoped cookie as UX convenience only.
3. **Daily rotation is server-side** (date-keyed lookup in the puzzles table), timed to midnight GST (UTC+4).

### Share mechanic
```
The Guesser #23 (World Cup Legends) 4/6 · 2 clues
🟩🟨⬛⬜⬛⬛
...
thereflectivefootball.com/guesser
```

### Data model (Supabase)
- `players` (id, person_id, canonical, name, category, league, clubs, nationality, position, birth_year, shirt_number, era, aliases, clues)
- `puzzles` (puzzle_date, mode, player_id) — RLS: server-only
- `plays` (user_id nullable, session_hash, puzzle_date, mode, guesses jsonb, solved, attempts)

---

## 7. The Reflections — Voting Spec

**Eight categories, in this order:** Best Video · Best Soundbite · Best Supporters Club · Best Supporter · Best Celebration · Best Heartbreak · Best Chant · Best Matchday Night.
Each category section: nominee cards (embedded video/clip, name, one-line context) + vote button.

### Voting rules
- **No account required to vote.** One vote per category.
- Votes POSTed to server, stored in `votes` table. NOTHING vote-related lives in the browser as source of truth.
- Dedupe per category: hashed IP + device fingerprint + a signed cookie. Rate limiting on the endpoint. Honeypot field against bots.
- Accepted limitation: VPN/incognito abuse is possible. Mitigation: `votes.user_id` is recorded when the voter is signed in — **authenticated votes are the verified tally.** If a category looks gamed, the official result can be computed from authenticated votes only. Build the admin query for both tallies from day one.
- Voting window: start/end timestamps in config; page states: before (preview), open (voting), closed (results/winners).

### Post-vote popup (the conversion moment)
Fires once after a successful vote (per vote, not per pageview — never nags):

> **Thanks for voting! Your pick is in.**
> Create your free Reflective Football account to:
> · See live results for The Reflections
> · Play The Guesser daily and keep your streak
> · Be first to new films, games, and news
> [ Sign up free ]  [ Maybe later ]

- "Maybe later" closes it; do not re-show in the same session.
- **Live standings are the signup-gated reward.** Anonymous voters vote blind; signed-in members see the live race per category. This is deliberate. Do not show public running totals.

### Data model
- `nominees` (id, category, title, youtube_id/clip_url, context_line, sort)
- `votes` (id, category, nominee_id, user_id nullable, fingerprint_hash, ip_hash, created_at) — unique constraints on (category, fingerprint_hash) and (category, user_id)

---

## 8. Films Archive

- `/films` — filterable grid (by club, venue, competition, format: catchmentary / podcast / short film / explainer). Cinematic cards using thumbnails.
- `/films/[slug]` — YouTube embed, title, description with chapter links, the story around the film (venue, fans, night), related films.
- **VideoObject JSON-LD schema on every film page** (title, description, thumbnail, upload date, embed URL). This is the SEO backbone.
- Films are **data entries, not hand-built pages**: one JSON/MDX file per film in `/content/films/`. This is what makes auto-publish (section 10) possible.
- Seed content: full back catalog — Season 1 episodes (Arsenal "North London Forever", Chelsea UAE, West Ham x2, Aston Villa, Man United), World Cup catchmentaries, top podcasts.

---

## 9. Account System

- Supabase Auth: Google one-tap + email magic link. No passwords.
- On signup: display name + favourite club (optional, feeds community segmentation later).
- `/account`: Guesser streak + stats, Reflections votes cast + live standings, sign out.
- Email capture here IS the newsletter list foundation. Store a marketing consent checkbox (pre-unchecked, PDPL-aware) at signup.
- Privacy page: plain-language, states what is stored (email, display name, game stats, votes), UAE PDPL-aware. Keep it human.

---

## 10. Auto-Publish Pipeline (build after v1 ships)

Skill for Claude Code: given a new YouTube URL →
1. Fetch metadata (title, description, thumbnail, publish date)
2. Generate `/content/films/[slug].json` (or .mdx) with chapters parsed from description
3. Update sitemap + structured data
4. Commit with conventional message, push → Vercel auto-deploys

Same pattern for games: new/updated game → arcade manifest entry → deploy.

---

## 11. SEO Baseline (v1, not v1.5)

- Per-page meta titles/descriptions, OG + Twitter cards (film thumbnail as OG image)
- VideoObject schema on film pages; WebSite + Organization schema on home
- XML sitemap, robots.txt, canonical URLs
- Core Web Vitals: lazy embeds, next/image, no layout shift on the grid

---

## 12. Build Order

1. **Repo + stack scaffold** — Next.js, Tailwind, Supabase wiring, design tokens, layout shell
2. **The Reflections page + voting API + popup** — time-critical, ships first
3. **The Guesser** — server-side game engine, anonymous play, account gate, share card
4. **Auth + /account** — required by both features above; build in parallel with 2–3
5. **Films archive** — content model + seed the back catalog
6. **Home** — assembles the above: hero, latest films, Reflections banner, Guesser CTA
7. **About, privacy, SEO pass, DNS cutover, launch**
8. **Post-launch:** auto-publish skill, then analytics events review after week one

## 13. Standing Rules (apply to all site copy)

- TRF voice: fans are protagonists. No disparaging material anywhere, including nominee context lines.
- Current year is 2026; Arsenal Champions League Final was May 30, 2026.
- Copy is short, clear, direct. No em-dashes.
- Nothing references We Are Football until it is announced.
