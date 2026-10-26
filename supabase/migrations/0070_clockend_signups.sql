create table if not exists public.clockend_signups (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  whatsapp text not null,
  instagram text,
  arsenal_uae_member boolean,
  attendance text[] not null default '{}',
  group_size text check (group_size in ('1','2','3-4','5+')),
  watch_style text check (watch_style in ('loud','calm','depends')),
  film_consent boolean,
  contact_consent boolean not null check (contact_consent = true),
  created_at timestamptz not null default now()
);
create unique index if not exists clockend_signups_whatsapp_key on public.clockend_signups (whatsapp);
alter table public.clockend_signups enable row level security;
drop policy if exists "clockend_insert_only" on public.clockend_signups;
create policy "clockend_insert_only" on public.clockend_signups
  for insert to anon, authenticated with check (contact_consent = true);
