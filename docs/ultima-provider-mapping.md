# Ultima Sportmonks provider mapping (v5)

**Status:** Live when `ULTIMA_PROVIDER=sportmonks` and `SPORTMONKS_API_KEY` are set in server env (Vercel / `.env.local`). Never commit the key.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `SPORTMONKS_API_KEY` | API token (server only) |
| `ULTIMA_PROVIDER` | Set to `sportmonks` to activate |
| `SPORTMONKS_LEAGUE_ID_PL` | Premier League Sportmonks league ID |
| `SPORTMONKS_LEAGUE_ID_LALIGA` | LaLiga league ID |
| `SPORTMONKS_LEAGUE_ID_SERIEA` | Serie A league ID |
| `SPORTMONKS_LEAGUE_ID_BUNDESLIGA` | Bundesliga league ID |
| `SPORTMONKS_LEAGUE_ID_LIGUE1` | Ligue 1 league ID |

Melo confirms each ID from the Sportmonks dashboard. The code reads env vars only; no IDs are hard-coded in the repo.

## Ultima slug → env var

| Ultima slug | Env var |
|-------------|---------|
| `pl` | `SPORTMONKS_LEAGUE_ID_PL` |
| `laliga` | `SPORTMONKS_LEAGUE_ID_LALIGA` |
| `seriea` | `SPORTMONKS_LEAGUE_ID_SERIEA` |
| `bundesliga` | `SPORTMONKS_LEAGUE_ID_BUNDESLIGA` |
| `ligue1` | `SPORTMONKS_LEAGUE_ID_LIGUE1` |

## Endpoints used

- `GET /v3/football/leagues/{id}?include=teams` — team list per league
- `GET /v3/football/squads/teams/{team_id}` — squad players
- `GET /v3/football/fixtures/between/{from}/{to}?filters=fixtureLeagues:{id}` — schedules
- `GET /v3/football/fixtures/{id}?include=lineups.details.type` — match stats

## Statistics type IDs

Confirm against Sportmonks docs for your plan. Defaults in code use common type IDs; override via env if needed:

| Stat | Env override | Default |
|------|--------------|---------|
| Goals | `SPORTMONKS_STAT_GOALS` | 52 |
| Assists | `SPORTMONKS_STAT_ASSISTS` | 79 |
| Rating | `SPORTMONKS_STAT_RATING` | 118 |

## Exit gate

One completed gameweek re-scored through Sportmonks matches mock structure. If rating sources differ, validate structure only and note in handover.

## v5 product rules

- Five leagues, 30-man squad, 15 starters (3 per league), 30 draft rounds (300 picks).
