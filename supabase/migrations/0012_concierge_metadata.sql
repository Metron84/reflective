-- Concierge metadata layer (venues, fan groups, videos, moments).
-- Schema only — no UI. Run in Supabase SQL Editor after 0011.
--
-- Admin model: profiles.is_admin (default false). No role system existed;
-- users cannot self-promote (blocked in protect_profile_immutables).
-- Grant admin manually, e.g.:
--   update public.profiles set is_admin = true where id = '<your-user-uuid>';

-- ---------------------------------------------------------------------------
-- Admin flag + helper
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create or replace function public.protect_profile_immutables()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.member_number := old.member_number;
    new.id := old.id;
    new.created_at := old.created_at;
    -- Clients cannot elevate themselves to admin.
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text,
  city text not null default 'Dubai',
  setting text check (setting in ('outdoor', 'indoor', 'rooftop', 'covered', 'mixed')),
  capacity_vibe text check (capacity_vibe in ('intimate', 'mid', 'large', 'massive')),
  outdoor_seating boolean,
  typical_group_max integer,
  food_drink_notes text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.fan_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  club text,
  country text,
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  youtube_id text not null unique,
  title text not null,
  published_at date,
  fixture text,
  fixture_date date,
  fixture_type text check (
    fixture_type in (
      'group_stage',
      'knockout',
      'final',
      'derby',
      'league',
      'friendly',
      'other'
    )
  ),
  competition text,
  venue_id uuid references public.venues (id) on delete set null,
  atmosphere_index integer check (atmosphere_index between 1 and 10),
  vibe_tags text[] not null default '{}',
  languages text[] not null default '{}',
  description text,
  created_at timestamptz not null default now()
);

create index if not exists videos_venue_id_idx on public.videos (venue_id);
create index if not exists videos_published_at_idx on public.videos (published_at desc);

create table if not exists public.video_fan_groups (
  video_id uuid not null references public.videos (id) on delete cascade,
  fan_group_id uuid not null references public.fan_groups (id) on delete cascade,
  primary key (video_id, fan_group_id)
);

create table if not exists public.video_moments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  timestamp_seconds integer not null check (timestamp_seconds >= 0),
  label text not null,
  moment_type text check (
    moment_type in (
      'goal_reaction',
      'chant',
      'celebration',
      'heartbreak',
      'arrival',
      'other'
    )
  ),
  created_at timestamptz not null default now()
);

create index if not exists video_moments_video_id_idx on public.video_moments (video_id);

-- ---------------------------------------------------------------------------
-- RLS: public read; admin writes
-- ---------------------------------------------------------------------------

alter table public.venues enable row level security;
alter table public.fan_groups enable row level security;
alter table public.videos enable row level security;
alter table public.video_fan_groups enable row level security;
alter table public.video_moments enable row level security;

-- Venues
create policy "Venues: public read"
  on public.venues for select
  to anon, authenticated
  using (true);

create policy "Venues: admin insert"
  on public.venues for insert
  to authenticated
  with check (public.is_admin());

create policy "Venues: admin update"
  on public.venues for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Venues: admin delete"
  on public.venues for delete
  to authenticated
  using (public.is_admin());

-- Fan groups
create policy "Fan groups: public read"
  on public.fan_groups for select
  to anon, authenticated
  using (true);

create policy "Fan groups: admin insert"
  on public.fan_groups for insert
  to authenticated
  with check (public.is_admin());

create policy "Fan groups: admin update"
  on public.fan_groups for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Fan groups: admin delete"
  on public.fan_groups for delete
  to authenticated
  using (public.is_admin());

-- Videos
create policy "Videos: public read"
  on public.videos for select
  to anon, authenticated
  using (true);

create policy "Videos: admin insert"
  on public.videos for insert
  to authenticated
  with check (public.is_admin());

create policy "Videos: admin update"
  on public.videos for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Videos: admin delete"
  on public.videos for delete
  to authenticated
  using (public.is_admin());

-- Video ↔ fan groups
create policy "Video fan groups: public read"
  on public.video_fan_groups for select
  to anon, authenticated
  using (true);

create policy "Video fan groups: admin insert"
  on public.video_fan_groups for insert
  to authenticated
  with check (public.is_admin());

create policy "Video fan groups: admin update"
  on public.video_fan_groups for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Video fan groups: admin delete"
  on public.video_fan_groups for delete
  to authenticated
  using (public.is_admin());

-- Video moments
create policy "Video moments: public read"
  on public.video_moments for select
  to anon, authenticated
  using (true);

create policy "Video moments: admin insert"
  on public.video_moments for insert
  to authenticated
  with check (public.is_admin());

create policy "Video moments: admin update"
  on public.video_moments for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Video moments: admin delete"
  on public.video_moments for delete
  to authenticated
  using (public.is_admin());
