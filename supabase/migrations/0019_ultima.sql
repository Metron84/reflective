-- Ultima: invite-only fantasy league schema (Phase A).
-- Run in the Supabase SQL editor after 0018_laliga_interest.sql.
--
-- RLS on every table. No client write policies: all mutations go through
-- server routes with the service role key. Authenticated human managers may
-- read league state; anonymous users read nothing from these tables.
--
-- Spec: docs/TRF_Ultima_Master_Spec.md section 20.

-- ---------------------------------------------------------------------------
-- Trigger helper (no table dependency; safe to define first)
-- ---------------------------------------------------------------------------

create or replace function public.ultima_deny_admin_log_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'ultima_admin_log is append only';
end;
$$;

revoke execute on function public.ultima_deny_admin_log_mutation()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Core competition
-- ---------------------------------------------------------------------------

create table if not exists public.ultima_competition (
  id uuid primary key default gen_random_uuid(),
  season_label text not null,
  max_seats integer not null default 10 check (max_seats = 10),
  timer_seconds integer check (
    timer_seconds is null
    or timer_seconds in (30, 60, 90, 120, 300, 86400)
  ),
  rating_thresholds jsonb not null default '{}'::jsonb,
  trade_deadline_gw integer not null default 4 check (trade_deadline_gw >= 1),
  window_rule text not null default 'fri_thu_gst',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ultima_competition_one_active_idx
  on public.ultima_competition (is_active)
  where is_active;

-- ---------------------------------------------------------------------------
-- Bot personas (seed from data/ultima/personas.json via server job)
-- ---------------------------------------------------------------------------

create table if not exists public.ultima_bot_personas (
  id text primary key,
  name text not null,
  risk numeric(4, 3) not null check (risk >= 0 and risk <= 1),
  horizon numeric(4, 3) not null check (horizon >= 0 and horizon <= 1),
  discipline numeric(4, 3) not null check (discipline >= 0 and discipline <= 1),
  wobble numeric(4, 3) not null check (wobble >= 0 and wobble <= 1),
  weights jsonb not null default '{}'::jsonb,
  rationale_lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Invites (server-write only; never exposed to clients)
-- ---------------------------------------------------------------------------

create table if not exists public.ultima_invites (
  code text primary key check (char_length(code) = 8),
  competition_id uuid not null references public.ultima_competition (id) on delete cascade,
  expires_at timestamptz not null,
  used_by uuid references auth.users (id),
  used_at timestamptz,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  check (
    (used_by is null and used_at is null)
    or (used_by is not null and used_at is not null)
  )
);

create index if not exists ultima_invites_competition_idx
  on public.ultima_invites (competition_id);

create index if not exists ultima_invites_expires_idx
  on public.ultima_invites (expires_at)
  where used_by is null;

-- ---------------------------------------------------------------------------
-- Managers (humans and bots)
-- ---------------------------------------------------------------------------

create table if not exists public.ultima_managers (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.ultima_competition (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  team_name text check (
    team_name is null
    or (char_length(team_name) >= 3 and char_length(team_name) <= 24)
  ),
  manager_name text,
  colour text,
  draft_slot integer check (draft_slot between 1 and 10),
  is_bot boolean not null default false,
  persona_id text references public.ultima_bot_personas (id),
  is_backup_commissioner boolean not null default false,
  profile_complete boolean not null default false,
  invite_id text references public.ultima_invites (code),
  created_at timestamptz not null default now(),
  check (
    (is_bot = true and user_id is null and persona_id is not null)
    or (is_bot = false and persona_id is null)
  ),
  check (
    profile_complete = false
    or (team_name is not null and manager_name is not null and colour is not null)
  )
);

create unique index if not exists ultima_managers_user_competition_key
  on public.ultima_managers (competition_id, user_id)
  where user_id is not null;

create unique index if not exists ultima_managers_draft_slot_key
  on public.ultima_managers (competition_id, draft_slot)
  where draft_slot is not null;

create unique index if not exists ultima_managers_team_name_key
  on public.ultima_managers (competition_id, lower(team_name))
  where team_name is not null;

create index if not exists ultima_managers_competition_idx
  on public.ultima_managers (competition_id);

-- ---------------------------------------------------------------------------
-- RLS helpers (after ultima_managers; SQL functions validate at create time)
-- ---------------------------------------------------------------------------

create or replace function public.ultima_current_manager_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from public.ultima_managers m
  where m.user_id = auth.uid()
    and m.is_bot = false
  limit 1;
$$;

create or replace function public.ultima_is_participant()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.ultima_current_manager_id() is not null;
$$;

grant execute on function public.ultima_current_manager_id() to authenticated;
grant execute on function public.ultima_is_participant() to authenticated;

-- ---------------------------------------------------------------------------
-- Player pool (mock seed / Sportmonks sync)
-- ---------------------------------------------------------------------------

create table if not exists public.ultima_players (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  name text not null,
  league text not null check (league in ('pl', 'laliga', 'seriea')),
  club text not null,
  active boolean not null default true,
  draft_round integer check (draft_round between 1 and 25),
  bolt_eligible boolean not null default false,
  inactive_flag boolean not null default false,
  inactive_reason text,
  seed_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, league)
);

create index if not exists ultima_players_league_active_idx
  on public.ultima_players (league, active);

create index if not exists ultima_players_club_idx
  on public.ultima_players (club);

-- ---------------------------------------------------------------------------
-- Draft lifecycle
-- ---------------------------------------------------------------------------

create table if not exists public.ultima_draft_state (
  competition_id uuid primary key references public.ultima_competition (id) on delete cascade,
  state text not null default 'lobby' check (
    state in ('lobby', 'live', 'paused', 'complete', 'cancelled')
  ),
  draft_order uuid[] not null default '{}'::uuid[],
  current_pick integer not null default 1 check (current_pick between 1 and 250),
  turn_expires_at timestamptz,
  paused_by uuid references auth.users (id),
  paused_at timestamptz,
  resume_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.ultima_draft_picks (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.ultima_competition (id) on delete cascade,
  manager_id uuid not null references public.ultima_managers (id) on delete cascade,
  player_id uuid not null references public.ultima_players (id),
  round integer not null check (round between 1 and 25),
  pick_number integer not null check (pick_number between 1 and 250),
  picked_at timestamptz not null default now(),
  auto_picked boolean not null default false,
  forced boolean not null default false,
  forced_league text check (
    forced_league is null or forced_league in ('pl', 'laliga', 'seriea')
  ),
  rationale text,
  unique (competition_id, pick_number),
  unique (competition_id, player_id)
);

create index if not exists ultima_draft_picks_manager_idx
  on public.ultima_draft_picks (manager_id, picked_at desc);

create table if not exists public.ultima_draft_queues (
  manager_id uuid not null references public.ultima_managers (id) on delete cascade,
  player_id uuid not null references public.ultima_players (id),
  position integer not null check (position >= 1),
  primary key (manager_id, player_id),
  unique (manager_id, position)
);

-- ---------------------------------------------------------------------------
-- Squads and lineups
-- ---------------------------------------------------------------------------

create table if not exists public.ultima_rosters (
  manager_id uuid not null references public.ultima_managers (id) on delete cascade,
  player_id uuid not null references public.ultima_players (id),
  acquired_at timestamptz not null default now(),
  primary key (manager_id, player_id)
);

create unique index if not exists ultima_rosters_player_key
  on public.ultima_rosters (player_id);

create table if not exists public.ultima_gameweeks (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.ultima_competition (id) on delete cascade,
  number integer not null check (number >= 1),
  window_start timestamptz not null,
  window_end timestamptz not null,
  league_open_at jsonb not null default '{}'::jsonb,
  state text not null default 'upcoming' check (
    state in ('upcoming', 'live', 'provisional', 'final')
  ),
  unique (competition_id, number),
  check (window_end > window_start)
);

create index if not exists ultima_gameweeks_competition_number_idx
  on public.ultima_gameweeks (competition_id, number);

create table if not exists public.ultima_lineups (
  manager_id uuid not null references public.ultima_managers (id) on delete cascade,
  gameweek_id uuid not null references public.ultima_gameweeks (id) on delete cascade,
  slot smallint not null check (slot between 1 and 11),
  slot_group text not null check (slot_group in ('pl', 'laliga', 'seriea', 'free')),
  player_id uuid references public.ultima_players (id),
  locked_at timestamptz,
  auto_started boolean not null default false,
  primary key (manager_id, gameweek_id, slot)
);

create unique index if not exists ultima_lineups_player_gameweek_key
  on public.ultima_lineups (gameweek_id, player_id)
  where player_id is not null;

-- ---------------------------------------------------------------------------
-- Fixtures and stats
-- ---------------------------------------------------------------------------

create table if not exists public.ultima_fixtures (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null unique,
  league text not null check (league in ('pl', 'laliga', 'seriea')),
  kickoff timestamptz not null,
  status text not null default 'scheduled',
  gameweek_id uuid references public.ultima_gameweeks (id),
  home_club text,
  away_club text,
  updated_at timestamptz not null default now()
);

create index if not exists ultima_fixtures_gameweek_idx
  on public.ultima_fixtures (gameweek_id, kickoff);

create index if not exists ultima_fixtures_league_kickoff_idx
  on public.ultima_fixtures (league, kickoff);

create table if not exists public.ultima_player_match_stats (
  fixture_id uuid not null references public.ultima_fixtures (id) on delete cascade,
  player_id uuid not null references public.ultima_players (id),
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  rating numeric(4, 2),
  raw_json jsonb not null default '{}'::jsonb,
  provider_revision text,
  updated_at timestamptz not null default now(),
  primary key (fixture_id, player_id)
);

create index if not exists ultima_player_match_stats_player_idx
  on public.ultima_player_match_stats (player_id);

-- ---------------------------------------------------------------------------
-- Scoring
-- ---------------------------------------------------------------------------

create table if not exists public.ultima_manager_gameweek_scores (
  manager_id uuid not null references public.ultima_managers (id) on delete cascade,
  gameweek_id uuid not null references public.ultima_gameweeks (id) on delete cascade,
  points numeric(6, 2) not null default 0,
  bolt_points numeric(6, 2) not null default 0,
  version integer not null default 1 check (version >= 1),
  state text not null default 'provisional' check (state in ('provisional', 'final')),
  updated_at timestamptz not null default now(),
  primary key (manager_id, gameweek_id)
);

create index if not exists ultima_manager_gameweek_scores_gameweek_idx
  on public.ultima_manager_gameweek_scores (gameweek_id, points desc);

-- ---------------------------------------------------------------------------
-- Market, trades, audit
-- ---------------------------------------------------------------------------

create table if not exists public.ultima_transactions (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.ultima_managers (id) on delete cascade,
  type text not null check (type in ('add', 'drop')),
  player_id uuid not null references public.ultima_players (id),
  related_player_id uuid references public.ultima_players (id),
  gameweek_id uuid references public.ultima_gameweeks (id),
  created_at timestamptz not null default now(),
  check (
    type = 'drop'
    or related_player_id is not null
  )
);

create index if not exists ultima_transactions_manager_idx
  on public.ultima_transactions (manager_id, created_at desc);

create table if not exists public.ultima_trades (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.ultima_competition (id) on delete cascade,
  proposer_id uuid not null references public.ultima_managers (id),
  receiver_id uuid not null references public.ultima_managers (id),
  state text not null check (
    state in (
      'proposed',
      'accepted',
      'declined',
      'review',
      'vetoed',
      'executed',
      'expired'
    )
  ),
  verdict_json jsonb,
  review_expires_at timestamptz,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (proposer_id <> receiver_id)
);

create index if not exists ultima_trades_competition_state_idx
  on public.ultima_trades (competition_id, state, created_at desc);

create table if not exists public.ultima_trade_players (
  trade_id uuid not null references public.ultima_trades (id) on delete cascade,
  player_id uuid not null references public.ultima_players (id),
  from_manager_id uuid not null references public.ultima_managers (id),
  to_manager_id uuid not null references public.ultima_managers (id),
  primary key (trade_id, player_id, from_manager_id)
);

create table if not exists public.ultima_trade_votes (
  trade_id uuid not null references public.ultima_trades (id) on delete cascade,
  manager_id uuid not null references public.ultima_managers (id),
  veto boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (trade_id, manager_id)
);

create table if not exists public.ultima_score_adjustments (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.ultima_managers (id),
  gameweek_id uuid not null references public.ultima_gameweeks (id),
  actor_id uuid not null references auth.users (id),
  reason text not null,
  before_json jsonb not null,
  after_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ultima_admin_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id),
  action text not null,
  reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ultima_admin_log_created_idx
  on public.ultima_admin_log (created_at desc);

drop trigger if exists ultima_admin_log_no_update on public.ultima_admin_log;
create trigger ultima_admin_log_no_update
  before update on public.ultima_admin_log
  for each row execute function public.ultima_deny_admin_log_mutation();

drop trigger if exists ultima_admin_log_no_delete on public.ultima_admin_log;
create trigger ultima_admin_log_no_delete
  before delete on public.ultima_admin_log
  for each row execute function public.ultima_deny_admin_log_mutation();

-- ---------------------------------------------------------------------------
-- Analytics (server-write only)
-- ---------------------------------------------------------------------------

create table if not exists public.ultima_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  manager_id uuid references public.ultima_managers (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ultima_events_event_created_idx
  on public.ultima_events (event, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.ultima_competition enable row level security;
alter table public.ultima_bot_personas enable row level security;
alter table public.ultima_invites enable row level security;
alter table public.ultima_managers enable row level security;
alter table public.ultima_players enable row level security;
alter table public.ultima_draft_state enable row level security;
alter table public.ultima_draft_picks enable row level security;
alter table public.ultima_draft_queues enable row level security;
alter table public.ultima_rosters enable row level security;
alter table public.ultima_gameweeks enable row level security;
alter table public.ultima_lineups enable row level security;
alter table public.ultima_fixtures enable row level security;
alter table public.ultima_player_match_stats enable row level security;
alter table public.ultima_manager_gameweek_scores enable row level security;
alter table public.ultima_transactions enable row level security;
alter table public.ultima_trades enable row level security;
alter table public.ultima_trade_players enable row level security;
alter table public.ultima_trade_votes enable row level security;
alter table public.ultima_score_adjustments enable row level security;
alter table public.ultima_admin_log enable row level security;
alter table public.ultima_events enable row level security;

-- Invites and analytics: no client policies (service role only).

create policy "ultima_competition: participants read"
  on public.ultima_competition
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_bot_personas: participants read"
  on public.ultima_bot_personas
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_managers: participants read"
  on public.ultima_managers
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_players: participants read"
  on public.ultima_players
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_draft_state: participants read"
  on public.ultima_draft_state
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_draft_picks: participants read"
  on public.ultima_draft_picks
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_draft_queues: participants read"
  on public.ultima_draft_queues
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_rosters: participants read"
  on public.ultima_rosters
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_gameweeks: participants read"
  on public.ultima_gameweeks
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_lineups: participants read"
  on public.ultima_lineups
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_fixtures: participants read"
  on public.ultima_fixtures
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_player_match_stats: participants read"
  on public.ultima_player_match_stats
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_manager_gameweek_scores: participants read"
  on public.ultima_manager_gameweek_scores
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_transactions: participants read"
  on public.ultima_transactions
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_trades: participants read"
  on public.ultima_trades
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_trade_players: participants read"
  on public.ultima_trade_players
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_trade_votes: participants read"
  on public.ultima_trade_votes
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_score_adjustments: participants read"
  on public.ultima_score_adjustments
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_admin_log: participants read"
  on public.ultima_admin_log
  for select
  to authenticated
  using (public.ultima_is_participant());
