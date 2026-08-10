# Beautiful Archive — maintenance cadence

Standing rules for keeping The Beautiful Archive accurate after launch.

## Cadence

- One new entry published per week, attached to that week's filming.
- Museum entries rechecked annually. Opening and ticketing details date fastest.
- Streaming availability rechecked every six months across the whole published set.
- Every correction received by email applied within one week, because the accuracy note on every entry page promises it.
- No further research passes until holding is under fifty.

## Non-negotiables

- Nothing publishes without `verified: true`.
- The validator flags bad data and never rewrites it.
- Holding is never precached and never indexed.
- Preview only via `NEXT_PUBLIC_ARCHIVE_PREVIEW` in `.env.local` (never in production).

## Open items

- Africa is the thinnest region and warrants one dedicated pass once holding is under fifty.
- Quarantined terrace music records name fanbases for a later song-level pass (see `content/archive/quarantine.json` notes).

## Local tooling

- `npm run validate:archive` — schema and integrity checks (runs in build).
- `npm run export:checklist` — regenerates `exports/archive-checklist.csv` and `exports/museum-worklist.csv` for hand verification.
- `npm run generate:archive-lenses` — local Ollama drafts only; promote by hand into `content/archive/lenses.json`.
