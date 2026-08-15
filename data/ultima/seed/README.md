# Ultima mock seed (Phase A)

Placeholder directory for the mock stats provider. Full contract: `docs/TRF_Ultima_Master_Spec.md` section 17.2.

## Required files (Phase A gate)

| File | Contents |
|------|----------|
| `players.pl.json` | ~500 draftable Premier League players |
| `players.laliga.json` | ~500 draftable LaLiga players |
| `players.seriea.json` | ~500 draftable Serie A players |
| `players.bundesliga.json` | SAMPLE Bundesliga players |
| `players.ligue1.json` | SAMPLE Ligue 1 players |
| `fixtures.json` | Scheduled and completed fixtures |
| `stats.gw-sample.json` | One completed gameweek (Appendix A v5: 15 slots, five leagues) |
| `rankings.json` | Manual draft ranking, one ordered list per league |

## Player fields

`provider_id`, `name`, `club`, `league`, `active`, `goals_rate`, `assists_rate`, `rating_avg`, `rating_consistency`, `minutes_reliability`, `club_strength`

## Exit gate

Seed loads through `MockProvider`, and the Appendix A worked example scores exactly. Live ratings come from Sportmonks (7.0 / 7.5 bands).

Do not invent real player stats. Use SAMPLE data clearly marked until Melo supplies the seed.
