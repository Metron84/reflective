-- crest_reveals: which Crest leagues a member has revealed on My Programme.
-- Run after 0067_programme_honours.sql. Not applied by the My Programme revamp branch.
--
-- One row per member per competition. Rows belong to one Crest result: the app deletes
-- a member's rows (service role) whenever crest_results.saved_at changes, and ignores
-- any row whose revealed_at is older than the current saved_at.
-- Members can read and insert their own rows. There is no update or delete policy.
-- The every_league honour is awarded by the server when the rows cover every league.

create table if not exists public.crest_reveals (
  user_id uuid not null references auth.users (id) on delete cascade,
  competition text not null,
  revealed_at timestamptz not null default now(),
  primary key (user_id, competition)
);

alter table public.crest_reveals enable row level security;
revoke all on table public.crest_reveals from anon;

create policy "crest_reveals: read own"
  on public.crest_reveals
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "crest_reveals: insert own"
  on public.crest_reveals
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Verify after running:
--   select relrowsecurity from pg_class where oid = 'public.crest_reveals'::regclass;   -- true
--   select polname, polcmd from pg_policy where polrelid = 'public.crest_reveals'::regclass;   -- r, a
