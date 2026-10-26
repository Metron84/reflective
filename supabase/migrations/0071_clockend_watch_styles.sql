alter table public.clockend_signups add column if not exists watch_styles text[] not null default '{}';
alter table public.clockend_signups drop constraint if exists clockend_watch_styles_valid;
alter table public.clockend_signups add constraint clockend_watch_styles_valid check (watch_styles <@ array['loud','calm','depends']::text[]);
