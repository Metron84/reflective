# Ultima Build Handover

**Date:** 14 August 2026  
**Spec:** `docs/TRF_Ultima_Master_Spec.md` (v4)  
**Feature flag:** `ULTIMA_ENABLED = false` in `lib/config.js` (nothing public until you flip it)

---

## What was built

### Phase A (foundation) — complete

| Item | Location | Notes |
|------|----------|-------|
| Master spec v4 | `docs/TRF_Ultima_Master_Spec.md` | Single source of truth |
| SQL schema | `supabase/migrations/0019_ultima.sql` | 21 tables, RLS, append-only admin log. **You ran this successfully.** |
| Bot persona seed | `supabase/migrations/0020_ultima_personas_seed.sql` | **Run this next** in Supabase SQL editor |
| Mock seed (SAMPLE) | `data/ultima/seed/` | Appendix A players, fixtures, GW12 stats, rankings |
| Bot config | `data/ultima/personas.json` | Nine personas for Phase H |
| Scoring engine | `lib/ultima/scoring.js` | Goals, assists, rating bands, Bolt bonus |
| Mock provider | `lib/ultima/provider/mock.js` | Reads seed JSON; Sportmonks adapter slot at Phase F |
| Snake draft helper | `lib/ultima/draft/snake.js` | 10-seat × 25-round order |
| Appendix QA | `scripts/ultima-verify-appendix.mjs` | Run: `node scripts/ultima-verify-appendix.mjs` → **PASS** (42 + 2 = 44) |
| Error codes | `lib/ultima/errors.js` | TRF voice, spec section 16.6 |

### Phase B (hub + invites + profile) — complete

| Route | Auth | Status |
|-------|------|--------|
| `/ultima` | Public | Hub with doors pattern, live status lines when manager exists |
| `/ultima/rules` | Public | Canonical scoring summary |
| `/ultima/join/[code]` | Sign-in | Invite redemption → profile |
| `/ultima/profile` | Manager | Team name, manager name, colour chip |
| `/api/ultima/invite/redeem` | Sign-in | Rate-limited, honeypot, 10-seat cap |
| `/api/ultima/profile` | Manager | Profile save, unique team name |

### Phases C–J — stub routes (auth-gated, no dead ends)

| Route | Phase | Notes |
|-------|-------|-------|
| `/ultima/draft` | C | Navy draft room UI pending |
| `/ultima/squad` | D | XI + Squad tabs pending |
| `/ultima/market` | E | Free agency pending |
| `/ultima/trades` | I | Trade machine pending |
| `/ultima/standings` | D | Table + Bolt board pending |
| `/ultima/log` | J | Public commissioner log pending |
| `/ultima/admin` | J | Commissioner tools; gated by `ULTIMA_COMMISSIONER_USER_IDS` env |

Each stub links back to the hub. Signed-out hits on manager routes redirect to `/signin?next=…`.

### Site integration

| Item | Behaviour while `ULTIMA_ENABLED = false` |
|------|------------------------------------------|
| Games door | Codemaster line (not Ultima copy) |
| `/games` card | Hidden (`parked` + flag filter in `lib/games/index.js`) |
| Sitemap | No `/ultima` entries |
| Routes | Built and reachable at `/ultima` for preview (robots noindex on hub when flag false) |

When you flip `ULTIMA_ENABLED = true`: games door, `/games` card, and sitemap entries go live.

---

## Migrations to run

You already ran **0019**. Run **0020** next:

```
supabase/migrations/0020_ultima_personas_seed.sql
```

Optional one-time bootstrap (uncomment in 0020 or run manually after Melo sets dates):

```sql
insert into public.ultima_competition (season_label, timer_seconds, rating_thresholds)
values (
  '2026/27',
  60,
  '{"pl":{"band1":7.0,"band2":7.5},"laliga":{"band1":7.0,"band2":7.5},"seriea":{"band1":7.0,"band2":7.5}}'::jsonb
);

insert into public.ultima_draft_state (competition_id, state)
select id, 'lobby' from public.ultima_competition where is_active = true limit 1;
```

**No further migrations** are required for Phases A–B. Phase C+ may add columns or indexes as features land; those will be new numbered files.

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Already set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Already set |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Invite redeem, profile, all Ultima writes |
| `ULTIMA_COMMISSIONER_USER_IDS` | Before admin | Comma-separated Supabase user UUIDs |

---

## How to test locally

1. Run migration **0020** in Supabase.
2. Bootstrap competition (SQL above).
3. Set `ULTIMA_COMMISSIONER_USER_IDS` to your user UUID.
4. Insert a test invite (commissioner issues via SQL until admin UI exists):

```sql
insert into public.ultima_invites (code, competition_id, expires_at, created_by)
select
  'TESTCODE',
  id,
  now() + interval '14 days',
  '<your-user-uuid>'::uuid
from public.ultima_competition where is_active = true limit 1;
```

5. `npm run dev` → open `http://localhost:4343/ultima/join/TESTCODE` (adjust code to match).
6. Sign in → join → profile → hub.

Verify scoring: `node scripts/ultima-verify-appendix.mjs`

---

## Phase gate checklist (Melo review)

### Phase A exit

- [x] Spec in repo
- [x] Schema applied (0019)
- [x] Mock seed loads via `MockProvider`
- [x] Appendix A scores exactly (42 + 2 Bolt = 44)
- [ ] Rating calibration study signed off (manual Melo task)
- [ ] Run 0020 personas seed

### Phase B exit

- [x] Hub, landing, rules
- [x] Invite redeem with 10-seat cap (server-enforced)
- [x] Profile save
- [x] Auth redirect `?next=`
- [ ] Eleventh redemption test (needs competition + 10 invites in DB)

### Not started (your next instructions)

- **C** Live draft room
- **D** Squad, XI, locks, scoring from seed GW
- **E** Market
- **F** Sportmonks adapter
- **G** Live matchday + SSE
- **H** Bot personas in draft
- **I** Trades
- **J** Admin + public log

---

## Open decisions (from spec §23)

- Draft date and timer option
- Gameweek 1 date
- Public standings or members only
- Backup commissioner
- Prize / on-camera league name
- Confirm **Ultima** as public name

---

## File map (new since last commit)

```
supabase/migrations/0019_ultima.sql
supabase/migrations/0020_ultima_personas_seed.sql
lib/ultima/
  constants.js  errors.js  scoring.js  personas.js  gates.js
  provider/mock.js
  server/db.js  server/personas-seed.js
  draft/snake.js
data/ultima/seed/*.json
scripts/ultima-verify-appendix.mjs
app/ultima/** 
app/api/ultima/**
components/ultima/**
docs/TRF_Ultima_Build_Handover.md
```

---

## Single-block summary

Ultima v4 is integrated into the TRF repo with a full Postgres schema (21 tables, RLS, append-only audit log), SAMPLE mock seed that reproduces Appendix A scoring (verified 44 points), a MockProvider adapter, scoring engine, snake draft helper, nine bot personas (JSON + SQL seed migration 0020), hub and rules pages, invite redemption and profile APIs, auth-gated stub routes for draft through admin, loading skeleton, and `ULTIMA_ENABLED` gating on games door, manifest, and sitemap. Migration 0019 is applied; run 0020 next, then bootstrap one competition row and issue invites. Flip `ULTIMA_ENABLED` when ready for public preview. Phases C–J await your go-ahead.
