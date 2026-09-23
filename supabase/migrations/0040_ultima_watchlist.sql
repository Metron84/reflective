-- Ultima market watchlist. Server writes only.
-- Run after 0026_ultima_practice_keep_and_chat.sql.

create table if not exists public.ultima_watchlist (
  manager_id uuid not null references public.ultima_managers (id) on delete cascade,
  player_id uuid not null references public.ultima_players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (manager_id, player_id)
);

create index if not exists ultima_watchlist_player_idx
  on public.ultima_watchlist (player_id);

alter table public.ultima_watchlist enable row level security;

create policy "ultima_watchlist: own read"
  on public.ultima_watchlist
  for select
  to authenticated
  using (
    manager_id in (
      select m.id
      from public.ultima_managers m
      where m.user_id = auth.uid()
        and m.is_bot = false
    )
  );
