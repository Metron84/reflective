-- Ultima trade block: list a player, declare open to trading, ask about a player.
-- Server writes only. Run after 0042_crest_results.sql.

create table if not exists public.ultima_trade_block (
  manager_id uuid not null references public.ultima_managers (id) on delete cascade,
  player_id uuid not null references public.ultima_players (id) on delete cascade,
  stance text not null check (stance in ('listed', 'open')),
  note text check (note is null or char_length(note) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (manager_id, player_id)
);

create index if not exists ultima_trade_block_player_idx
  on public.ultima_trade_block (player_id);

create table if not exists public.ultima_trade_prefs (
  manager_id uuid primary key references public.ultima_managers (id) on delete cascade,
  looking_for text[] not null default '{}',
  note text check (note is null or char_length(note) <= 80),
  updated_at timestamptz not null default now()
);

create table if not exists public.ultima_trade_interest (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.ultima_competition (id) on delete cascade,
  from_manager_id uuid not null references public.ultima_managers (id) on delete cascade,
  to_manager_id uuid not null references public.ultima_managers (id) on delete cascade,
  player_id uuid references public.ultima_players (id) on delete cascade,
  message text check (message is null or char_length(message) <= 120),
  state text not null default 'new' check (state in ('new', 'seen', 'offered', 'dismissed')),
  created_at timestamptz not null default now(),
  check (from_manager_id <> to_manager_id)
);

-- One ask per manager per player; one general ask per manager pair.
create unique index if not exists ultima_trade_interest_player_uidx
  on public.ultima_trade_interest (from_manager_id, to_manager_id, player_id)
  where player_id is not null;

create unique index if not exists ultima_trade_interest_general_uidx
  on public.ultima_trade_interest (from_manager_id, to_manager_id)
  where player_id is null;

create index if not exists ultima_trade_interest_to_idx
  on public.ultima_trade_interest (to_manager_id, state, created_at desc);

alter table public.ultima_trade_block enable row level security;
alter table public.ultima_trade_prefs enable row level security;
alter table public.ultima_trade_interest enable row level security;

-- The block is public inside the league: participants read, server writes.
create policy "ultima_trade_block: participants read"
  on public.ultima_trade_block
  for select
  to authenticated
  using (public.ultima_is_participant());

create policy "ultima_trade_prefs: participants read"
  on public.ultima_trade_prefs
  for select
  to authenticated
  using (public.ultima_is_participant());

-- Interest is private to the two managers involved.
create policy "ultima_trade_interest: parties read"
  on public.ultima_trade_interest
  for select
  to authenticated
  using (
    from_manager_id in (
      select m.id from public.ultima_managers m
      where m.user_id = auth.uid() and m.is_bot = false
    )
    or to_manager_id in (
      select m.id from public.ultima_managers m
      where m.user_id = auth.uid() and m.is_bot = false
    )
  );
