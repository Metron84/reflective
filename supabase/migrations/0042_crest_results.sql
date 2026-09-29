-- One saved Crest per account. Answers rebuild the report. Club and share are a snapshot.

create table if not exists public.crest_results (
  user_id uuid primary key references auth.users (id) on delete cascade,
  answers jsonb not null,
  stake text,
  scope text,
  club_slug text not null,
  room_pct integer not null,
  saved_at timestamptz not null default now()
);

create table if not exists public.crest_handoffs (
  token uuid primary key default gen_random_uuid(),
  answers jsonb not null,
  stake text,
  scope text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists crest_handoffs_expires_at_idx
  on public.crest_handoffs (expires_at);

alter table public.crest_results enable row level security;
alter table public.crest_handoffs enable row level security;

create policy crest_results_select_own
  on public.crest_results for select
  using (auth.uid() = user_id);

create policy crest_results_insert_own
  on public.crest_results for insert
  with check (auth.uid() = user_id);

create policy crest_results_update_own
  on public.crest_results for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Handoffs are written and read only through the server route with the user session
-- or a one-time token. No direct client policies.
