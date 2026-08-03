-- Codemaster: one solve row per signed-in user per puzzle.
-- RLS on, no client policies: service role only (same pattern as plays).
-- Run in the Supabase SQL editor after 0016_nominee_nation.sql.

create table if not exists public.codemaster_solves (
  user_id uuid not null references auth.users (id) on delete cascade,
  puzzle_id text not null,
  score integer not null check (score >= 0),
  hints integer not null default 0 check (hints >= 0),
  attribution boolean not null default false,
  solved_at timestamptz not null default now(),
  primary key (user_id, puzzle_id)
);

create index if not exists codemaster_solves_user_idx
  on public.codemaster_solves (user_id);

alter table public.codemaster_solves enable row level security;
