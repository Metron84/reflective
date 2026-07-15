-- Home page newsletter signups.
-- RLS enabled, no client policies: inserts go through server routes only.

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  consent boolean not null,
  created_at timestamptz not null default now(),
  constraint subscribers_consent_true check (consent = true)
);

create unique index if not exists subscribers_email_lower_key
  on public.subscribers (lower(trim(email)));

alter table public.subscribers enable row level security;
