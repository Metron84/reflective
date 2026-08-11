-- LaLiga Nights Dubai interest form.
-- Run in the Supabase SQL Editor after 0017_codemaster_solves.sql.
-- Public can insert. No select policy: reads stay server-side / dashboard only.

create table if not exists public.laliga_interest (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  first_name text not null,
  whatsapp text not null,
  club text not null,
  frequency text not null,
  group_size text not null,
  best_day text not null,
  miss_most text,
  contact_ok boolean default false,
  filming_ok boolean default false,
  source text default 'instagram'
);

alter table public.laliga_interest enable row level security;

grant insert on table public.laliga_interest to anon;

create policy "laliga_interest: anon insert"
  on public.laliga_interest for insert
  to anon
  with check (true);
