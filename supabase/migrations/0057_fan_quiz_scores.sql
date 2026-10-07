-- Applied to production. Do not re-run.
-- fan_quiz_scores: saved scores from "Are You Really a Fan?" (play.thereflectivefootball.com).
-- Run after 0056_ultima_action_keys.sql.
--
-- The game never writes here. The main site claim route verifies a signed
-- hand-off token, then calls fan_quiz_claim() with the service role.
-- One claim per game session (unique session_id). A replay returns the existing row.
-- One counted entry per account per Dubai day: the first claimed session of the day.
-- Weeks run Monday 00:00 to Sunday 23:59 Dubai time (Asia/Dubai, UTC+4).
-- RLS is on and there are no table policies. The public reads the leaderboard view only.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

create table if not exists public.fan_quiz_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null unique,
  score integer not null,
  answered integer not null check (answered between 0 and 10),
  correct integer not null check (correct between 0 and 10),
  incorrect integer not null check (incorrect between 0 and 10),
  completed_at timestamptz not null,
  claimed_at timestamptz not null default now(),
  play_day date not null,
  week_start date not null,
  counted boolean not null default false,
  check (correct + incorrect = answered)
);

create unique index if not exists fan_quiz_scores_one_counted_per_day
  on public.fan_quiz_scores (user_id, play_day)
  where counted;

create index if not exists fan_quiz_scores_week_idx
  on public.fan_quiz_scores (week_start)
  where counted;

alter table public.fan_quiz_scores enable row level security;
revoke all on table public.fan_quiz_scores from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Claim (atomic, idempotent per session)
-- ---------------------------------------------------------------------------

create or replace function public.fan_quiz_claim(
  p_user uuid,
  p_session uuid,
  p_score integer,
  p_answered integer,
  p_correct integer,
  p_incorrect integer,
  p_completed timestamptz
)
returns table (
  out_score integer,
  out_answered integer,
  out_correct integer,
  out_incorrect integer,
  out_counted boolean,
  out_already_claimed boolean,
  out_user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_day date := (v_now at time zone 'Asia/Dubai')::date;
  v_week date := date_trunc('week', v_now at time zone 'Asia/Dubai')::date;
  v_row public.fan_quiz_scores;
begin
  -- Serialise claims per account so "first of the day" cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  select * into v_row from public.fan_quiz_scores s where s.session_id = p_session;
  if found then
    return query select v_row.score, v_row.answered, v_row.correct, v_row.incorrect,
      v_row.counted, true, v_row.user_id;
    return;
  end if;

  insert into public.fan_quiz_scores
    (user_id, session_id, score, answered, correct, incorrect, completed_at, claimed_at, play_day, week_start, counted)
  values
    (p_user, p_session, p_score, p_answered, p_correct, p_incorrect, p_completed, v_now, v_day, v_week,
     not exists (
       select 1 from public.fan_quiz_scores s
       where s.user_id = p_user and s.play_day = v_day and s.counted
     ))
  returning * into v_row;

  return query select v_row.score, v_row.answered, v_row.correct, v_row.incorrect,
    v_row.counted, false, v_row.user_id;
end;
$$;

revoke all on function public.fan_quiz_claim(uuid, uuid, integer, integer, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.fan_quiz_claim(uuid, uuid, integer, integer, integer, integer, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3. Public leaderboard view
-- ---------------------------------------------------------------------------
-- Best counted score per account per week. Tie-break: more correct, then fewer
-- questions answered, then earlier completion. Exposes display name, score,
-- correct, week. No user ids.

create or replace view public.fan_quiz_leaderboard as
select
  t.week_start,
  t.display_name,
  t.score,
  t.correct,
  t.answered,
  t.completed_at,
  row_number() over (
    partition by t.week_start
    order by t.score desc, t.correct desc, t.answered asc, t.completed_at asc
  )::integer as rank
from (
  select
    b.week_start,
    coalesce(nullif(trim(p.preferred_name), ''), 'A fan') as display_name,
    b.score,
    b.correct,
    b.answered,
    b.completed_at
  from (
    select distinct on (s.week_start, s.user_id)
      s.week_start, s.user_id, s.score, s.correct, s.answered, s.completed_at
    from public.fan_quiz_scores s
    where s.counted
    order by s.week_start, s.user_id, s.score desc, s.correct desc, s.answered asc, s.completed_at asc
  ) b
  left join public.profiles p on p.id = b.user_id
) t;

grant select on public.fan_quiz_leaderboard to anon, authenticated;

-- Verify after running:
--   select relrowsecurity from pg_class where oid = 'public.fan_quiz_scores'::regclass;   -- true
--   select count(*) from pg_policies where tablename = 'fan_quiz_scores';                  -- 0
--   select * from public.fan_quiz_leaderboard limit 1;                                     -- empty is fine
