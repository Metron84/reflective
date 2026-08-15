# Ultima Build Handover (v5)

**Date:** 15 August 2026  
**Spec:** `docs/TRF_Ultima_Master_Spec.md` (update to v5 in progress)  
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
| `0021_ultima_v5_leagues.sql` | **Run next** (5 leagues, 15 slots, 300 picks) |

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
| `SPORTMONKS_LEAGUE_ID_PL` | From Sportmonks dashboard |
| `SPORTMONKS_LEAGUE_ID_LALIGA` | From dashboard |
| `SPORTMONKS_LEAGUE_ID_SERIEA` | From dashboard |
| `SPORTMONKS_LEAGUE_ID_BUNDESLIGA` | From dashboard |
| `SPORTMONKS_LEAGUE_ID_LIGUE1` | From dashboard |

Never commit keys. See `docs/ultima-provider-mapping.md`.

---

## Commissioner workflow

1. Run migrations 0020 + 0021 in Supabase.
2. Set all env vars above.
3. `/ultima/admin` → **Bootstrap** (sync players + sample GW if mock).
4. **Sync players** uses Sportmonks when provider is active.
5. Issue invites → Start draft.

Dev: `http://localhost:4343/api/dev/test-sign-in?next=/ultima&ultima=1`

---

## Cron routes (wire in Vercel)

| Route | Purpose |
|-------|---------|
| `/api/cron/ultima/trade-expiry` | Trade review expiry + draft timer auto-pick |
| `/api/cron/ultima/lineup-lock` | League lock events + bot auto-XI |

---

## Still open for Melo

- [ ] Confirm Sportmonks league IDs in env
- [ ] Run migration 0021
- [ ] Rating calibration for 5 leagues
- [ ] Full acceptance test pass (spec §22, v5 numbers)
- [ ] Resend email notifications (optional launch)
- [ ] Open decisions: draft date, GW1, public standings, prize name
- [ ] Production deploy approval

---

## Verify

```bash
node scripts/ultima-verify-appendix.mjs   # v4 sample still PASS (3-league appendix)
npm run build
```

Note: Appendix A is still the 3-league / 11-slot worked example until a v5 appendix is authored.
