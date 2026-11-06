# TRF bots

Six commercial bots built from the Shared Brain and the thinker database.

## Use
- Paste a file from `dist/` as the system prompt of a Claude Project (one project per bot).
- Start at The Partner unless you name a bot.

## Rebuild after editing the Brain
```bash
node bots/build.mjs
```

## Files
- `TRF_Shared_Brain.md`: source of truth, edited only by Melo.
- `src/thinkers.json`: the 21 thinkers used (extracted from the 353 database).
- `build.mjs`: composes each prompt.
- `dist/`: ready-to-paste prompts.

## Notes
- The Brain bans Bodoni Moda and the `channel_stats` counter; `CLAUDE.md` still uses the counter. Resolve before launch.
