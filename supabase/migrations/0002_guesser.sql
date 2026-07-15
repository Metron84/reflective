-- The Guesser: players, puzzles, plays.
-- Run BEFORE importing seed data. RLS enabled with no policies:
-- clients get zero access. The answer never reaches the client; all
-- game logic goes through server routes with the service role key.

create table if not exists public.players (
  id text primary key,
  name text not null,
  category text not null,
  league text,
  clubs text[] not null default '{}',
  nationality text not null,
  position text not null,
  birth_year integer not null,
  shirt_number integer,
  era_start integer,
  era_end integer,
  world_cup_editions integer[] not null default '{}',
  aliases text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Date-keyed daily answers, one row per (date, mode). Zero client
-- read access is the airtight rule; server-only.
create table if not exists public.puzzles (
  id uuid primary key default gen_random_uuid(),
  puzzle_date date not null,
  mode text not null,
  player_id text not null references public.players (id),
  difficulty_notes text,
  created_at timestamptz not null default now(),
  unique (puzzle_date, mode)
);

create table if not exists public.plays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  session_hash text,
  puzzle_date date not null,
  mode text not null,
  guesses jsonb not null default '[]',
  solved boolean not null default false,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists plays_puzzle_idx on public.plays (puzzle_date, mode);
create index if not exists plays_user_idx on public.plays (user_id) where user_id is not null;
-- One recorded play per anonymous session per daily puzzle.
create unique index if not exists plays_session_daily_key
  on public.plays (session_hash, puzzle_date, mode)
  where session_hash is not null;

alter table public.players enable row level security;
alter table public.puzzles enable row level security;
alter table public.plays enable row level security;
