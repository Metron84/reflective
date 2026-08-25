-- Media Training applications.
-- Run after 0027_ultima_claim_draft_pick.sql.
-- Public can insert. No select policy: reads stay server-side / dashboard only.
-- Note: 0019 is already Ultima; this file is numbered 0028.

create table if not exists public.training_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  full_name text not null,
  email text not null,
  whatsapp text not null,
  describes_you text not null,
  why_seat text not null,
  filmed_before text not null,
  accepted_terms boolean not null default false,
  accepted_fee boolean not null default false,
  requested_payment_details boolean not null default false,
  accepted_at timestamptz not null default now(),
  source text default 'training'
);

alter table public.training_applications enable row level security;

grant insert on table public.training_applications to anon;

create policy "training_applications: anon insert"
  on public.training_applications for insert
  to anon
  with check (true);
