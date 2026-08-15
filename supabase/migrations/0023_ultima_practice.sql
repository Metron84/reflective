-- Ultima practice drafts: isolated competitions (is_active = false).
-- Run after 0022_ultima_notifications.sql.

alter table public.ultima_competition
  add column if not exists kind text not null default 'season';

alter table public.ultima_competition
  drop constraint if exists ultima_competition_kind_check;

alter table public.ultima_competition
  add constraint ultima_competition_kind_check
  check (kind in ('season', 'practice'));

create table if not exists public.ultima_practice_rooms (
  code text primary key check (char_length(code) = 4),
  competition_id uuid not null unique references public.ultima_competition (id) on delete cascade,
  host_user_id uuid not null references auth.users (id),
  solo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ultima_practice_rooms_host_idx
  on public.ultima_practice_rooms (host_user_id, created_at desc);

alter table public.ultima_practice_rooms enable row level security;

create policy "ultima_practice_rooms: participants read"
  on public.ultima_practice_rooms
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.ultima_managers m
      where m.competition_id = ultima_practice_rooms.competition_id
        and m.user_id = auth.uid()
        and m.is_bot = false
    )
  );
