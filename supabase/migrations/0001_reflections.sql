-- The Reflections: nominees + votes.
-- Run in the Supabase SQL editor (or via supabase db push) BEFORE
-- inserting any real data. RLS is enabled with no policies: clients
-- get zero access, all reads and writes go through server routes
-- using the service role key.

create table if not exists public.nominees (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  youtube_id text,
  clip_url text,
  context_line text,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  nominee_id uuid not null references public.nominees (id),
  user_id uuid references auth.users (id),
  fingerprint_hash text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

-- One vote per category per device, and per account when signed in.
create unique index if not exists votes_category_fingerprint_key
  on public.votes (category, fingerprint_hash);
create unique index if not exists votes_category_user_key
  on public.votes (category, user_id)
  where user_id is not null;

alter table public.nominees enable row level security;
alter table public.votes enable row level security;

-- Admin tallies, both modes from day one (spec section 7).
-- All votes:
create or replace view public.reflections_tally_all
  with (security_invoker = on) as
select v.category, v.nominee_id, n.title, count(*)::int as votes
from public.votes v
join public.nominees n on n.id = v.nominee_id
group by v.category, v.nominee_id, n.title
order by v.category, votes desc;

-- Verified tally, authenticated votes only (the official fallback if
-- a category looks gamed):
create or replace view public.reflections_tally_authenticated
  with (security_invoker = on) as
select v.category, v.nominee_id, n.title, count(*)::int as votes
from public.votes v
join public.nominees n on n.id = v.nominee_id
where v.user_id is not null
group by v.category, v.nominee_id, n.title
order by v.category, votes desc;
