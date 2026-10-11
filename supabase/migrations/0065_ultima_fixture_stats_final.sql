-- Per-fixture flag: stop polling once Sportmonks ratings have landed.

alter table public.ultima_fixtures
  add column if not exists stats_final boolean not null default false;

create index if not exists ultima_fixtures_gameweek_stats_final_idx
  on public.ultima_fixtures (gameweek_id, stats_final)
  where stats_final = false;
