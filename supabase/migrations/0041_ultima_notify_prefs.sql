-- Manager notification toggles. Missing keys mean on.
alter table public.ultima_managers
  add column if not exists notify_prefs jsonb not null default '{}'::jsonb;
