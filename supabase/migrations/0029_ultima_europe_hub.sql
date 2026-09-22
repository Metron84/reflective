-- Europe desk for the Ultima hub. Sportmonks-synced fixtures, standings and match stats.
-- Run after 0028_training_applications.sql.

alter table public.ultima_fixtures
  add column if not exists sportmonks_fixture_id bigint,
  add column if not exists league_code text,
  add column if not exists home_club_id bigint,
  add column if not exists away_club_id bigint,
  add column if not exists kickoff_at timestamptz,
  add column if not exists home_score integer,
  add column if not exists away_score integer;

update public.ultima_fixtures
set
  kickoff_at = coalesce(kickoff_at, kickoff),
  league_code = coalesce(
    league_code,
    case league
      when 'pl' then 'ENG'
      when 'laliga' then 'ESP'
      when 'seriea' then 'ITA'
      when 'bundesliga' then 'GER'
      when 'ligue1' then 'FRA'
      else null
    end
  ),
  sportmonks_fixture_id = coalesce(
    sportmonks_fixture_id,
    case
      when provider_id ~ '^sm-fix-[0-9]+$'
        then substring(provider_id from '^sm-fix-([0-9]+)$')::bigint
      else null
    end
  );

alter table public.ultima_fixtures
  drop constraint if exists ultima_fixtures_league_code_check;

alter table public.ultima_fixtures
  add constraint ultima_fixtures_league_code_check
  check (
    league_code is null
    or league_code in ('ENG', 'ESP', 'ITA', 'GER', 'FRA')
  );

alter table public.ultima_fixtures
  drop constraint if exists ultima_fixtures_scores_check;

alter table public.ultima_fixtures
  add constraint ultima_fixtures_scores_check
  check (
    (home_score is null and away_score is null)
    or (
      home_score is not null
      and away_score is not null
      and home_score >= 0
      and away_score >= 0
    )
  );

create unique index if not exists ultima_fixtures_sportmonks_id_key
  on public.ultima_fixtures (sportmonks_fixture_id)
  where sportmonks_fixture_id is not null;

create index if not exists ultima_fixtures_status_kickoff_idx
  on public.ultima_fixtures (status, kickoff_at);

alter table public.ultima_player_match_stats
  add column if not exists id uuid,
  add column if not exists sportmonks_fixture_id bigint,
  add column if not exists sportmonks_player_id bigint,
  add column if not exists minutes integer,
  add column if not exists clean_sheet boolean,
  add column if not exists yellow_cards integer,
  add column if not exists red_cards integer;

update public.ultima_player_match_stats
set id = coalesce(id, gen_random_uuid());

alter table public.ultima_player_match_stats
  alter column id set default gen_random_uuid();

alter table public.ultima_player_match_stats
  alter column id set not null;

alter table public.ultima_player_match_stats
  drop constraint if exists ultima_player_match_stats_pkey;

alter table public.ultima_player_match_stats
  add primary key (id);

alter table public.ultima_player_match_stats
  alter column player_id drop not null;

update public.ultima_player_match_stats s
set sportmonks_fixture_id = f.sportmonks_fixture_id
from public.ultima_fixtures f
where s.fixture_id = f.id
  and s.sportmonks_fixture_id is null;

update public.ultima_player_match_stats s
set sportmonks_player_id = (p.seed_metrics ->> 'sportmonks_player_id')::bigint
from public.ultima_players p
where s.player_id = p.id
  and s.sportmonks_player_id is null
  and p.seed_metrics ? 'sportmonks_player_id';

create unique index if not exists ultima_player_match_stats_fixture_player_key
  on public.ultima_player_match_stats (fixture_id, player_id)
  where player_id is not null;

create unique index if not exists ultima_player_match_stats_sm_key
  on public.ultima_player_match_stats (sportmonks_fixture_id, sportmonks_player_id)
  where sportmonks_fixture_id is not null
    and sportmonks_player_id is not null;

create table if not exists public.ultima_standings (
  league text not null check (league in ('pl', 'laliga', 'seriea', 'bundesliga', 'ligue1')),
  league_code text not null check (league_code in ('ENG', 'ESP', 'ITA', 'GER', 'FRA')),
  season_id bigint not null,
  club_id bigint not null,
  club_name text not null,
  position integer not null check (position >= 1),
  played integer not null default 0 check (played >= 0),
  won integer not null default 0 check (won >= 0),
  drawn integer not null default 0 check (drawn >= 0),
  lost integer not null default 0 check (lost >= 0),
  goals_for integer not null default 0 check (goals_for >= 0),
  goals_against integer not null default 0 check (goals_against >= 0),
  points integer not null default 0,
  previous_position integer,
  updated_at timestamptz not null default now(),
  primary key (league, club_id)
);

create index if not exists ultima_standings_league_position_idx
  on public.ultima_standings (league, position);

create table if not exists public.ultima_standings_history (
  as_of date not null,
  league text not null check (league in ('pl', 'laliga', 'seriea', 'bundesliga', 'ligue1')),
  club_id bigint not null,
  position integer not null check (position >= 1),
  primary key (as_of, league, club_id)
);

create table if not exists public.ultima_europe_sync (
  id text primary key default 'europe',
  last_ok_at timestamptz,
  last_error text,
  last_fixture_count integer,
  ratings_available boolean,
  stats_backfilled boolean not null default false,
  last_stat_counts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.ultima_europe_sync (id)
values ('europe')
on conflict (id) do nothing;

alter table public.ultima_standings enable row level security;
alter table public.ultima_standings_history enable row level security;
alter table public.ultima_europe_sync enable row level security;

drop policy if exists "ultima_standings: participants read" on public.ultima_standings;
create policy "ultima_standings: participants read"
  on public.ultima_standings
  for select
  to authenticated
  using (public.ultima_is_participant());

drop policy if exists "ultima_standings_history: participants read" on public.ultima_standings_history;
create policy "ultima_standings_history: participants read"
  on public.ultima_standings_history
  for select
  to authenticated
  using (public.ultima_is_participant());

drop policy if exists "ultima_europe_sync: participants read" on public.ultima_europe_sync;
create policy "ultima_europe_sync: participants read"
  on public.ultima_europe_sync
  for select
  to authenticated
  using (public.ultima_is_participant());
