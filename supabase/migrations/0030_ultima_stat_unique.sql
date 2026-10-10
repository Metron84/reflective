-- Ultima match stats: one row per player per fixture, and one row per Sportmonks pair.
-- The indexes from 0029 were partial, so PostgREST ON CONFLICT could not use them
-- and every stat upsert failed. Run after 0029. Apply by hand in the SQL editor.
-- Does not touch production until you run it.

-- Newest row wins. updated_at, then id, breaks a tie.
delete from public.ultima_player_match_stats s
using (
  select id
  from (
    select
      id,
      row_number() over (
        partition by fixture_id, player_id
        order by updated_at desc nulls last, id desc
      ) as rn
    from public.ultima_player_match_stats
    where player_id is not null
  ) ranked
  where rn > 1
) dupes
where s.id = dupes.id;

delete from public.ultima_player_match_stats s
using (
  select id
  from (
    select
      id,
      row_number() over (
        partition by sportmonks_fixture_id, sportmonks_player_id
        order by updated_at desc nulls last, id desc
      ) as rn
    from public.ultima_player_match_stats
    where sportmonks_fixture_id is not null
      and sportmonks_player_id is not null
  ) ranked
  where rn > 1
) dupes
where s.id = dupes.id;

drop index if exists public.ultima_player_match_stats_fixture_player_key;
drop index if exists public.ultima_player_match_stats_sm_key;

create unique index ultima_player_match_stats_fixture_player_key
  on public.ultima_player_match_stats (fixture_id, player_id);

create unique index ultima_player_match_stats_sm_key
  on public.ultima_player_match_stats (sportmonks_fixture_id, sportmonks_player_id);
