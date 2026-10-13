-- fan_quiz_scores.skipped: questions a player skipped in "Are You Really a Fan?".
-- A skip counts as answered and scores 0, so correct + incorrect + skipped = answered.
-- Run after 0065_ultima_fixture_stats_final.sql.

alter table public.fan_quiz_scores
  add column if not exists skipped integer not null default 0 check (skipped between 0 and 10);

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.fan_quiz_scores'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%correct + incorrect%'
      and conname <> 'fan_quiz_scores_counts_check'
  loop
    execute format('alter table public.fan_quiz_scores drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.fan_quiz_scores
  add constraint fan_quiz_scores_counts_check check (correct + incorrect + skipped = answered);

-- The claim function gains p_skipped, so the old signature goes.
drop function if exists public.fan_quiz_claim(uuid, uuid, integer, integer, integer, integer, timestamptz);

create or replace function public.fan_quiz_claim(
  p_user uuid,
  p_session uuid,
  p_score integer,
  p_answered integer,
  p_correct integer,
  p_incorrect integer,
  p_skipped integer,
  p_completed timestamptz
)
returns table (
  out_score integer,
  out_answered integer,
  out_correct integer,
  out_incorrect integer,
  out_skipped integer,
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
    return query select v_row.score, v_row.answered, v_row.correct, v_row.incorrect, v_row.skipped,
      v_row.counted, true, v_row.user_id;
    return;
  end if;

  insert into public.fan_quiz_scores
    (user_id, session_id, score, answered, correct, incorrect, skipped, completed_at, claimed_at, play_day, week_start, counted)
  values
    (p_user, p_session, p_score, p_answered, p_correct, p_incorrect, p_skipped, p_completed, v_now, v_day, v_week,
     not exists (
       select 1 from public.fan_quiz_scores s
       where s.user_id = p_user and s.play_day = v_day and s.counted
     ))
  returning * into v_row;

  return query select v_row.score, v_row.answered, v_row.correct, v_row.incorrect, v_row.skipped,
    v_row.counted, false, v_row.user_id;
end;
$$;

revoke all on function public.fan_quiz_claim(uuid, uuid, integer, integer, integer, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.fan_quiz_claim(uuid, uuid, integer, integer, integer, integer, integer, timestamptz)
  to service_role;
