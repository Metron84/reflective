-- The Treble: register interest from clubs and hosts.
-- 0019 is already Ultima. Run after 0068_crest_reveals.sql.
-- Public can insert. No select policy: reads stay server-side / dashboard only.

create table if not exists public.treble_interest (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  role text not null check (role in ('club', 'host')),
  full_name text not null,
  org_name text not null,
  club_supported text,
  members int,
  interest text,
  whatsapp text not null,
  email text not null,
  consent boolean not null,
  constraint treble_interest_members_check check (
    members is null or (members >= 0 and members <= 100000)
  ),
  constraint treble_interest_interest_check check (
    interest is null
    or interest in (
      'Host a leg',
      'Sponsor the day',
      'Sponsor a prize',
      'Other'
    )
  ),
  constraint treble_interest_consent_check check (consent = true)
);

alter table public.treble_interest enable row level security;

grant insert on table public.treble_interest to anon;

drop policy if exists "treble_interest: anon insert" on public.treble_interest;

create policy "treble_interest: anon insert"
  on public.treble_interest for insert
  to anon
  with check (true);
