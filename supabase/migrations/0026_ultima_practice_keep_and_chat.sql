-- Saved practice rooms, event competition scope, and manager chat.
-- Run after 0025_ultima_roster_scope.sql.

alter table public.ultima_practice_rooms
  add column if not exists keep boolean not null default false;

create index if not exists ultima_practice_rooms_keep_idx
  on public.ultima_practice_rooms (keep, created_at);

alter table public.ultima_events
  add column if not exists competition_id uuid references public.ultima_competition (id) on delete cascade;

update public.ultima_events e
set competition_id = m.competition_id
from public.ultima_managers m
where e.manager_id = m.id
  and e.competition_id is null;

create index if not exists ultima_events_competition_created_idx
  on public.ultima_events (competition_id, created_at desc);

create table if not exists public.ultima_chat_messages (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.ultima_competition (id) on delete cascade,
  manager_id uuid not null references public.ultima_managers (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists ultima_chat_messages_comp_created_idx
  on public.ultima_chat_messages (competition_id, created_at desc);

alter table public.ultima_chat_messages enable row level security;

create policy "ultima_chat_messages: participants read"
  on public.ultima_chat_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.ultima_managers m
      where m.competition_id = ultima_chat_messages.competition_id
        and m.user_id = auth.uid()
        and m.is_bot = false
    )
  );

create policy "ultima_chat_messages: own insert"
  on public.ultima_chat_messages
  for insert
  to authenticated
  with check (
    manager_id in (
      select m.id
      from public.ultima_managers m
      where m.user_id = auth.uid()
        and m.is_bot = false
        and m.competition_id = ultima_chat_messages.competition_id
    )
  );
