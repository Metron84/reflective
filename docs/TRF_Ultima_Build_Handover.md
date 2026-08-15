# Ultima Build Handover (v5)

**Date:** 15 August 2026  
**Spec:** `docs/TRF_Ultima_Master_Spec.md` (v5)  
**Feature flag:** `ULTIMA_ENABLED` in `lib/config.js`

---

## v5 product rules (confirmed)

| Rule | Value |
|------|-------|
| Leagues | PL, LaLiga, Serie A, Bundesliga, Ligue 1 |
| Squad | 30 (3 minimum per league) |
| Starters | 15 (3 per league, all score) |
| Draft | 30 rounds, 300 picks, 10 seats |
| Provider | Sportmonks when `ULTIMA_PROVIDER=sportmonks` |

**Copy:** "Draft Europe's top five. Thirty players. Fifteen score each week. Invite only."

---

## Migrations

| File | Status |
|------|--------|
| `0019_ultima.sql` | Applied |
| `0020_ultima_personas_seed.sql` | Run if not done |
| `0021_ultima_v5_leagues.sql` | Applied |
| `0022_ultima_notifications.sql` | Applied |
| `0023_ultima_practice.sql` | Applied |
| `0024_ultima_auto_draft.sql` | Applied |

---

## Environment variables (Vercel / `.env.local`)

| Variable | Required |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| `ULTIMA_COMMISSIONER_USER_IDS` | Yes for admin |
| `CRON_SECRET` | Yes for cron routes |
| `SPORTMONKS_API_KEY` | Yes for live data |
| `ULTIMA_PROVIDER` | Set to `sportmonks` |
| `SPORTMONKS_LEAGUE_ID_*` (5 leagues) | From Sportmonks dashboard |
| `RESEND_API_KEY` | Yes for Ultima emails (reuse Concierge key) |

Never commit keys. See `docs/ultima-provider-mapping.md`.

---

## Commissioner workflow

1. Run migration **0022** in Supabase.
2. Set all env vars above.
3. `/ultima/admin` → **Bootstrap** (sync players + sample GW12 mock).
4. **Schedule draft** (ISO datetime) for 24h/1h reminder emails.
5. **Start draft** when seats are full.
6. Change the clock from `/ultima/admin` or the live draft room. It resets the current turn.
7. Create live gameweek → **Sync active gameweek** during matchdays.

Dev: `http://localhost:4343/api/dev/test-sign-in?next=/ultima&ultima=1`

---

## Cron routes (vercel.json)

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/ultima/trade-expiry` | Daily 05:00 UTC (Hobby) | Trade review expiry + draft auto-pick |
| `/api/cron/ultima/reminders` | Daily 06:00 UTC (Hobby) | Draft 24h/1h reminders |
| `/api/cron/ultima/lineup-lock` | Daily 07:00 UTC (Hobby) | League locks, bot XI, Sportmonks sync, XI reminders |

Hobby only allows daily crons. Restore hourly / every 5 minutes after a Pro upgrade. Draft expiry still runs when the room polls.

---

## Appendix A (v5)

15 slots, five leagues. Expected totals: **base 39, Bolt +2, total 41**.

```bash
node scripts/ultima-verify-appendix.mjs
npm run build
```

Rating bands stay at Sportmonks 7.0 / 7.5 in every league. No calibration pass.

---

## Email notifications (Resend)

| Trigger | Implemented |
|---------|-------------|
| On the clock (timer ≥ 5 min) | Yes |
| Auto-pick on expiry | Yes |
| Draft 24h / 1h before | Yes (requires Schedule draft) |
| XI not set (3h before first lock) | Yes |
| Trade proposed | Yes |
| Gameweek final | In-app SSE only |

---

## Still open for Melo

- [ ] Push to GitHub, then formal acceptance pass (spec §22)
- [ ] Group decisions: draft date, GW1, public standings, prize name
- [ ] Production deploy approval

Closed: rating calibration. Trust Sportmonks. Default bands 7.0 / 7.5.
