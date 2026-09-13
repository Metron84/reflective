-- The Crest: club identity vectors (Section 1 data layer).
-- Run after 0032_fatf_referrals.sql.
-- Anon may read only. Writes use the service role in server code.

create or replace function public.crest_clubs_arrays_valid(
  v smallint[],
  c smallint[]
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    v is not null
    and c is not null
    and coalesce(array_length(v, 1), 0) = 12
    and coalesce(array_length(c, 1), 0) = 12
    and not exists (
      select 1 from unnest(v) as x(val) where val < 1 or val > 7
    )
    and not exists (
      select 1 from unnest(c) as x(val) where val < 1 or val > 3
    );
$$;

revoke execute on function public.crest_clubs_arrays_valid(smallint[], smallint[])
  from public, anon, authenticated;

create table if not exists public.crest_clubs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  common_name text,
  city text,
  country text,
  founded int,
  nickname text,
  motto text,
  ownership_model text,
  cluster text not null,
  vector smallint[] not null,
  confidence smallint[] not null default '{3,3,3,3,3,3,3,3,3,3,3,3}',
  evidence jsonb not null default '{}'::jsonb,
  identity_summary text,
  football_identity text,
  rituals jsonb not null default '[]'::jsonb,
  narratives jsonb not null default '[]'::jsonb,
  stadium jsonb not null default '{}'::jsonb,
  primary_rivalry jsonb not null default '{}'::jsonb,
  exclusion_clubs text[] not null default '{}',
  archetype text,
  sportmonks_id int,
  badge_url text,
  socials jsonb not null default '{}'::jsonb,
  uae jsonb not null default '{}'::jsonb,
  trf_film_youtube_id text,
  vector_version text not null default '1.1',
  research_status text not null default 'sample',
  last_reviewed timestamptz,
  reviewed_by text[] not null default '{}',
  source_quality_notes text,
  contested_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crest_clubs_arrays_valid check (
    public.crest_clubs_arrays_valid(vector, confidence)
  ),
  constraint crest_clubs_research_status_check check (
    research_status in ('sample', 'draft', 'reviewed', 'validated')
  )
);

create index if not exists crest_clubs_cluster_idx on public.crest_clubs (cluster);
create index if not exists crest_clubs_sportmonks_id_idx on public.crest_clubs (sportmonks_id)
  where sportmonks_id is not null;

alter table public.crest_clubs enable row level security;

create policy "crest_clubs: anon and authenticated read"
  on public.crest_clubs for select
  to anon, authenticated
  using (true);
