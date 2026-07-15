# CLAUDE.md — The Reflective Football Website

This file is the standing rulebook for every Claude Code session in this repo. Read it fully before acting. If anything here conflicts with an ad-hoc instruction, ask before proceeding.

## What this project is

thereflectivefootball.com — the website of The Reflective Football (TRF), a fan-first football documentary network based in Dubai. v1 ships three features: Films archive, The Reflections awards voting, and The Guesser daily game with a TRF account system. Full spec: `docs/TRF_Website_v1_Build_Spec.md` (keep the spec in the repo under /docs).

## Stack

- Next.js (App Router) + Tailwind, deployed on Vercel
- Supabase: Postgres + Auth
  - Project URL: https://ydffdymjgkpoogrgzjvy.supabase.co
  - Anon/publishable keys: client-side, via env vars
  - Service role key: SERVER ONLY, lives exclusively in Vercel/local env vars. Never in code, never in commits, never printed in output.
  - IMPORTANT: the original service role key was exposed in a chat and must be treated as compromised. Before connecting to Supabase with elevated privileges, confirm with Melo that the key has been rotated in the Supabase dashboard and the NEW key is in the env vars. Do not proceed with the old key.
- Domain: thereflectivefootball.com (DNS at weboasis.ae — Melo updates DNS manually; never instruct a cutover before Melo approves the Vercel preview)

## Brand (non-negotiable)

- Colors: warm paper cream `#F2EDE4` (site base), deep navy `#0A111F` (text + footage sections), signal red `#D8232A` (single accent: vote actions, key rules, "the fans").
- The site is CREAM-FIRST: editorial print feel, like a beautifully set matchday programme. Navy is for typography and for footage-led blocks; red stays scarce.
- Dark sections remain where footage leads: film cards, video heroes, The Guesser board, and any block built around a still or embed sits on navy — footage always pops from dark. The rhythm of the site is cream editorial pages punctuated by dark cinematic footage blocks.
- Background: use the subtle cream texture asset (public/brand/texture-cream-site-bg.png) or an equivalent CSS grain — never flat sterile white, never heavy marble.
- Accessibility: navy on cream passes contrast easily; never place red text on navy or cream body text below AA contrast.
- Type: Bodoni Moda (display/headlines), Archivo (UI/body).
- Logo: circular crest, navy/red/cream. Assets in /public/brand/: trf-crest-transparent.png (1072px, master, works on light and dark), trf-icon-512/192/180/32.png, favicon.ico. A true vector SVG does not exist yet; the PNG master is sufficient for v1.
- The design must feel like TRF films: dark, cinematic, footage-led, editorial. Never template-like. Consult the frontend-design skill.
- Tagline: "Football is nothing without the fans."
- Official channels: YouTube https://www.youtube.com/@TheReflectiveFootball (full episodes, interviews, Shorts), Instagram @thereflectivefootball.
- Public contact email: melo@thereflectivefootball.com (footer, about page, and contact points).

## Voice & copy rules

- NO DEAD ENDS (site-wide law): every page and every completed action ends with a visible next step. Users are fed clear paths, never left in silence. After a vote: auto-advance to the next unvoted category. After the 8th vote: completion moment with three paths (see live results / play The Guesser / watch the films). After a Guesser result: share + next nudge. Film pages: related films + a nudge. The home page is an index that feeds visitors every product in one scroll.
- Fans are protagonists. No disparaging copy anywhere, including nominee context lines and error messages.
- Copy is short, clear, direct. No em-dashes.
- Current year is 2026. The Arsenal Champions League Final was May 30, 2026.
- Do NOT mention or reference "We Are Football" anywhere on the site. Unannounced.
- English v1; architecture should not block Arabic/French locales later (use next-intl-compatible structure or keep strings centralized).

## The Reflections — configuration

- Eight categories, in this order: Best Video, Best Soundbite, Best Supporters Club, Best Supporter, Best Celebration, Best Heartbreak, Best Chant, Best Matchday Night.
- Voting opens at site launch. Voting closes: 2026-08-31 23:59 GST (UTC+4). Winners announced September 1. Public copy shows the winners date only; close is enforced server-side.
- Categories roll out in stages: each category has an `open` flag in config. Closed categories show "Nominees announced shortly." Progress counts open categories only.
- No account required to vote. One vote per category, deduped server-side (hashed IP + fingerprint + signed cookie, unique constraints in DB). Rate-limit the endpoint. Honeypot field.
- Record user_id on votes when signed in. Build the admin tally query with two modes from day one: all votes / authenticated-only (verified tally).
- Live standings are visible ONLY to signed-in users. No public running totals.
- Post-vote popup fires once per successful vote, never re-shows in-session:
  "Thanks for voting! Your pick is in." + free account benefits (live results, The Guesser daily, first to new films/games/news) + [Sign up free] [Maybe later].

## The Guesser — configuration

**Full spec:** `docs/TRF_Guesser_Master_Spec.md` (supersedes all prior Guesser instructions).

Summary: person-first daily game (Wordle-style attribute grid + TRF clue ladder). One footballer per day per mode. Matching, suggestions, solve, and dedupe operate on `person_id`. Classic compares canonical rows; mode boards compare that mode's row. Share format: `The Guesser #N (Mode) 4/6 · 2 clues` with 🟩🟨⬛⬜ grid. `/guesser?mode=` for all seven modes.

## Accounts

- Supabase Auth: email magic link + Google sign-in. Google OAuth client is created (consent screen: "The Reflective Football", External/testing mode). Client ID + secret go into Supabase (Authentication → Providers → Google) and env vars — Melo provides them directly, never via chat. Authorized origins: https://thereflectivefootball.com and http://localhost:4343. Redirect URI: the Supabase auth callback. No passwords.
- Signup captures: display name, favourite club (optional), marketing consent checkbox (pre-unchecked).
- /account shows: per-mode Guesser streaks + stats, Reflections votes cast + live standings.

## Rolling view counter (home page hero module)

- Server fetches real channel stats for https://www.youtube.com/@TheReflectiveFootball via the YouTube Data API v3 (key in env vars; resolve the channel ID from the handle on first run and store it) every 10–15 minutes; store timestamped readings in a Supabase `channel_stats` table.
- Client renders an odometer-style counter that ticks upward at the computed views-per-minute velocity from recent readings, re-syncing to each real reading. It is an estimate between real anchor points — never invent a number unmoored from API data.
- Combined-platform figure includes an Instagram views value stored in Supabase that Melo updates manually.
- Digits animate on page load. Design it as a cinematic hero moment ("X views and counting", Bodoni display, fans-first framing) — one counter on the home page, not a widget scattered across pages.
- Cache API calls sensibly; the free YouTube API quota (10,000 units/day) is far more than enough at one channels.list call per 10 minutes, but never poll from the client.

## Engineering rules

- Dev server runs on port 4343 (`next dev -p 4343`). For Google OAuth locally, add `http://localhost:4343` to the OAuth client authorized origins in Google Cloud and Supabase (previously 8595). Do not use port 3000 for anything auth-related.
- Films and games are data entries (`/content/films/*.json`, games manifest), never hand-built pages. VideoObject JSON-LD on every film page.
- Enable RLS on EVERY Supabase table before it holds real data. Votes and puzzles are server-write/server-read only.
- Secrets only in env vars (`.env.local` gitignored). If a secret ever appears in a diff, stop and flag it.
- Work in phases per the spec's build order. Stop for Melo's review at the end of each phase. Never deploy to production or touch DNS without explicit approval; previews are fine.
- Conventional commits. Small, reviewable changes.
- Mobile-first: most traffic arrives from Instagram on phones.
- Performance: lazy YouTube embeds (facade), next/image, no layout shift.

## When unsure

Ask Melo. Do not invent nominees, players, film descriptions, metrics, or dates. Facts about TRF come from Melo or the docs in /docs, never from assumption.
