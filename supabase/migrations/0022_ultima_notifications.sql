-- Ultima: notification dedupe log + draft schedule for reminder crons.
-- Run after 0021_ultima_v5_leagues.sql.

alter table public.ultima_draft_state
  add column if not exists scheduled_at timestamptz;

create table if not exists public.ultima_notification_log (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid references public.ultima_managers (id) on delete cascade,
  kind text not null,
  ref_id text not null,
  sent_at timestamptz not null default now(),
  unique (manager_id, kind, ref_id)
);

create index if not exists ultima_notification_log_kind_idx
  on public.ultima_notification_log (kind, sent_at desc);

alter table public.ultima_notification_log enable row level security;

-- Server-only writes; no client read policy (service role bypasses RLS).
