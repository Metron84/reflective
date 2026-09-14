-- For All The Fans: register interest on the member profile.
-- Run after 0038_kotb_applications.sql.
-- Anon may not read other members. Members may read and update their own row.

alter table public.profiles
  add column if not exists fatf_interest boolean not null default false,
  add column if not exists fatf_interest_at timestamptz,
  add column if not exists fatf_role text,
  add column if not exists consent_wording_version text,
  add column if not exists signup_source text;

alter table public.profiles
  drop constraint if exists profiles_fatf_role_check;

alter table public.profiles
  add constraint profiles_fatf_role_check
  check (
    fatf_role is null
    or fatf_role in ('work', 'venue', 'club', 'fan')
  );

comment on column public.profiles.fatf_interest is
  'Member registered interest in For All The Fans nights.';
comment on column public.profiles.signup_source is
  'Where the member completed the relevant signup, e.g. for-all-the-fans.';

create table if not exists public.fatf_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event text not null,
  user_id uuid references auth.users (id) on delete set null,
  meta jsonb not null default '{}'::jsonb
);

alter table public.fatf_events enable row level security;

-- No anon or authenticated policies. Writes go through the service role only.

create index if not exists fatf_events_created_at_idx
  on public.fatf_events (created_at desc);

create index if not exists fatf_events_event_idx
  on public.fatf_events (event);
