-- Who would you rather watch the match with?
-- Anonymous session cookie. Writes go through the service role only.

create table if not exists public.watch_with_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  club_slug text not null,
  deck jsonb not null,
  pick_count int not null default 0,
  incumbent_id text,
  last_pick_at timestamptz,
  champion_id text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.watch_with_swipes (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.watch_with_runs (id) on delete cascade,
  session_id uuid not null,
  winner_id text not null,
  loser_id text not null,
  club_slug text not null,
  step int not null,
  created_at timestamptz not null default now(),
  unique (run_id, step)
);

create table if not exists public.watch_with_ratings (
  card_id text not null,
  club_slug text not null,
  elo numeric not null default 1500,
  votes int not null default 0,
  wins int not null default 0,
  primary key (club_slug, card_id)
);

create index if not exists watch_with_runs_session_idx
  on public.watch_with_runs (session_id, club_slug, completed_at);

create index if not exists watch_with_ratings_elo_idx
  on public.watch_with_ratings (club_slug, elo desc);

alter table public.watch_with_runs enable row level security;
alter table public.watch_with_swipes enable row level security;
alter table public.watch_with_ratings enable row level security;
