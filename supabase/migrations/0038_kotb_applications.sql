-- King of the Burgers applications.
-- Documents the live public.kotb_applications table. Do not treat this as a
-- schema change if the table already exists in Supabase.
-- Run after 0037_crest_clubs_kit_family.sql.
-- Public can insert. No select policy: reads stay server-side / admin only.

create table if not exists public.kotb_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  venue_name text not null,
  area text not null,
  outlet_count int,
  contact_name text not null,
  contact_role text,
  contact_email text not null,
  contact_mobile text not null,
  instagram_handle text,
  instagram_followers int,
  burger_name text not null,
  why_it_should_win text,
  is_halal boolean,
  shows_live_football boolean,
  screen_count int,
  matchday_footfall int,
  can_host_weekend_shoot boolean,
  availability_notes text,
  what_winning_means text,
  status text not null default 'new',
  seed int,
  admin_notes text
);

alter table public.kotb_applications enable row level security;

grant insert on table public.kotb_applications to anon;

drop policy if exists "kotb_applications: anon insert" on public.kotb_applications;

create policy "kotb_applications: anon insert"
  on public.kotb_applications for insert
  to anon
  with check (true);

create index if not exists kotb_applications_created_at_idx
  on public.kotb_applications (created_at desc);

create index if not exists kotb_applications_status_idx
  on public.kotb_applications (status);
