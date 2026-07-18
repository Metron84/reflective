# Players import SQL (407 rows)

Generated from `data/players_seed.json`. Run in Supabase SQL Editor **in order** after the Guesser schema script.

| File | Rows |
|------|------|
| `players_batch_01.sql` | 80 |
| `players_batch_02.sql` | 80 |
| `players_batch_03.sql` | 80 |
| `players_batch_04.sql` | 80 |
| `players_batch_05.sql` | 80 |
| `players_batch_06.sql` | 7 |

**Total:** 407 rows

After all batches:

```sql
select count(*) from public.players;
select category, count(*) from public.players group by category order by category;
```

Expected: world_cup 90, premier_league 100, la_liga 55, serie_a 55, bundesliga 52, ligue_1 55.
