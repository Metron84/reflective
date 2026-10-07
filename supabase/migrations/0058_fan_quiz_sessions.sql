-- Applied to production. Do not re-run.
-- fan_quiz_sessions: server-side state for "Are You Really a Fan?".
-- Access: service role only. RLS is on and there are no policies for anon or authenticated.

create table if not exists public.fan_quiz_sessions (
  id           uuid primary key default gen_random_uuid(),
  state        jsonb not null,
  version      integer not null default 0,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  claimed_by   uuid,
  claimed_at   timestamptz
);

alter table public.fan_quiz_sessions enable row level security;

-- Belt and braces: no table privileges for the public API roles.
revoke all on table public.fan_quiz_sessions from anon, authenticated;

create index if not exists fan_quiz_sessions_started_at_idx
  on public.fan_quiz_sessions (started_at);

create index if not exists fan_quiz_sessions_claimed_by_idx
  on public.fan_quiz_sessions (claimed_by)
  where claimed_by is not null;

-- Verify after running (expect rowsecurity = true and zero policies):
--   select relrowsecurity from pg_class where oid = 'public.fan_quiz_sessions'::regclass;
--   select count(*) from pg_policies where tablename = 'fan_quiz_sessions';
