-- Concierge handoff inbox (Write to Melo).
-- Run in Supabase SQL Editor after 0012.
-- Public can insert; only admins can read/update/delete.

create table if not exists public.concierge_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  email text,
  topic text not null,
  message text not null,
  source_conversation jsonb not null default '[]'::jsonb,
  status text not null default 'new'
);

create index if not exists concierge_messages_created_at_idx
  on public.concierge_messages (created_at desc);

create index if not exists concierge_messages_status_idx
  on public.concierge_messages (status);

alter table public.concierge_messages enable row level security;

create policy "Concierge messages: public insert"
  on public.concierge_messages for insert
  to anon, authenticated
  with check (true);

create policy "Concierge messages: admin select"
  on public.concierge_messages for select
  to authenticated
  using (public.is_admin());

create policy "Concierge messages: admin update"
  on public.concierge_messages for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Concierge messages: admin delete"
  on public.concierge_messages for delete
  to authenticated
  using (public.is_admin());
