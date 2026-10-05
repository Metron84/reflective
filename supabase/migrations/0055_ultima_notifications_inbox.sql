-- Ultima notifications: inbox, Web Push subscriptions, commissioner broadcasts.
-- Run after 0054_ultima_captain_off_and_counter.sql.
-- NOT YET APPLIED. Melo runs this in the Supabase SQL editor.
--
-- Per-category push on/off reuses ultima_managers.notify_prefs (0041). No new
-- column: the new keys are push_offers, push_review, push_shortlist, push_squad,
-- push_locks and push_broadcasts. A missing key means on.
--
-- Every write is server side (service role). Managers can only read their own
-- notifications and subscriptions. There are no insert, update or delete
-- policies for the authenticated role.

-- ---------------------------------------------------------------------------
-- 1. Inbox
-- ---------------------------------------------------------------------------

create table if not exists public.ultima_notifications (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.ultima_managers (id) on delete cascade,
  competition_id uuid not null references public.ultima_competition (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  link text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_status text not null default 'skipped'
    check (push_status in ('queued', 'sent', 'held', 'skipped', 'failed')),
  send_after timestamptz
);

create index if not exists ultima_notifications_manager_created_idx
  on public.ultima_notifications (manager_id, created_at desc);

create index if not exists ultima_notifications_unread_idx
  on public.ultima_notifications (manager_id)
  where read_at is null;

-- The scheduled job reads held and stuck queued pushes.
create index if not exists ultima_notifications_push_due_idx
  on public.ultima_notifications (send_after)
  where push_status in ('held', 'queued');

alter table public.ultima_notifications enable row level security;

drop policy if exists "ultima_notifications: own read" on public.ultima_notifications;
create policy "ultima_notifications: own read"
  on public.ultima_notifications
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

revoke insert, update, delete on public.ultima_notifications from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Web Push subscriptions
-- ---------------------------------------------------------------------------

create table if not exists public.ultima_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.ultima_managers (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);

create index if not exists ultima_push_subscriptions_manager_idx
  on public.ultima_push_subscriptions (manager_id);

alter table public.ultima_push_subscriptions enable row level security;

drop policy if exists "ultima_push_subscriptions: own read" on public.ultima_push_subscriptions;
create policy "ultima_push_subscriptions: own read"
  on public.ultima_push_subscriptions
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

revoke insert, update, delete on public.ultima_push_subscriptions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Commissioner broadcasts
-- ---------------------------------------------------------------------------

create table if not exists public.ultima_broadcasts (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.ultima_competition (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  body text not null check (char_length(body) between 1 and 280),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index if not exists ultima_broadcasts_competition_idx
  on public.ultima_broadcasts (competition_id, created_at desc);

alter table public.ultima_broadcasts enable row level security;

drop policy if exists "ultima_broadcasts: league read" on public.ultima_broadcasts;
create policy "ultima_broadcasts: league read"
  on public.ultima_broadcasts
  for select
  to authenticated
  using (
    competition_id in (
      select m.competition_id
      from public.ultima_managers m
      where m.user_id = auth.uid()
        and m.is_bot = false
    )
  );

revoke insert, update, delete on public.ultima_broadcasts from anon, authenticated;
