-- ONE-OFF. Run once the season's gameweeks are synced. Not a migration.
-- Sets trade_deadline_gw = (last gameweek of the season) - 2 for the season
-- competition: the close of the third-from-last gameweek (spec 12.1).

-- Step 1. Dry run. Writes nothing. Check "would_set" before running step 2.
select
  c.id as competition_id,
  c.season_label,
  c.trade_deadline_gw as current_deadline,
  count(g.id) as gameweeks_synced,
  max(g.number) as last_gameweek,
  max(g.number) - 2 as would_set
from public.ultima_competition c
left join public.ultima_gameweeks g on g.competition_id = c.id
where c.is_active and c.kind = 'season'
group by c.id, c.season_label, c.trade_deadline_gw;

-- Step 2. The write. It refuses to run until at least 6 gameweeks exist, so a
-- half-synced season cannot set a deadline too early. It prints the number set.
update public.ultima_competition c
set trade_deadline_gw = s.last_gameweek - 2,
    updated_at = now()
from (
  select g.competition_id, max(g.number) as last_gameweek
  from public.ultima_gameweeks g
  group by g.competition_id
  having max(g.number) >= 6
) s
where c.id = s.competition_id
  and c.is_active
  and c.kind = 'season'
returning c.season_label, c.trade_deadline_gw as deadline_set_to_gameweek;
