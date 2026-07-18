# Players import SQL

Generated from `data/players_seed.json`. Run in Supabase SQL Editor **in order** after the Guesser schema script.

## Original seed (batches 01–06)

| File | Rows |
|------|------|
| `players_batch_01.sql` | 80 |
| `players_batch_02.sql` | 80 |
| `players_batch_03.sql` | 80 |
| `players_batch_04.sql` | 80 |
| `players_batch_05.sql` | 80 |
| `players_batch_06.sql` | 7 |

**Subtotal:** 407 rows (already applied if you ran these earlier).

## TM top-300 SAMPLE merge (new rows only)

Run **after** 01–06. SAMPLE clue ladders; authored TRF voice drops in later.

| File | Rows |
|------|------|
| `players_batch_tm_01.sql` | 80 |
| `players_batch_tm_02.sql` | 80 |
| `players_batch_tm_03.sql` | 80 |
| `players_batch_tm_04.sql` | 52 |
| `players_batch_tm_05.sql` | 6 |

**New rows:** 298  
**Seed total after merge:** 705

After all batches:

```sql
select count(*) from public.players;
select category, count(*) from public.players group by category order by category;
```

Expected after TM merge: world_cup 90, premier_league 158, la_liga 115, serie_a 115, bundesliga 112, ligue_1 115 (705 total).
