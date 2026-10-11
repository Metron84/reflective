-- One transaction per pick: validate, swipe, Elo, run update.
-- Service role only. Elo K = 24, start 1500, 400ms gap.

create or replace function public.watch_with_upsert_rating(
  p_card_id text,
  p_club_slug text,
  p_segment text,
  p_elo numeric,
  p_votes_before int,
  p_win boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if p_votes_before = 0 and not exists (
    select 1 from public.watch_with_ratings
    where card_id = p_card_id and club_slug = p_club_slug and segment = p_segment
  ) then
    insert into public.watch_with_ratings (card_id, club_slug, segment, elo, votes, wins)
    values (
      p_card_id,
      p_club_slug,
      p_segment,
      p_elo,
      1,
      case when p_win then 1 else 0 end
    );
  else
    update public.watch_with_ratings
    set elo = p_elo,
        votes = votes + 1,
        wins = wins + case when p_win then 1 else 0 end
    where card_id = p_card_id
      and club_slug = p_club_slug
      and segment = p_segment
      and votes = p_votes_before;
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'rating-race';
    end if;
  end if;
end;
$$;

create or replace function public.watch_with_apply_segment_elo(
  p_club_slug text,
  p_winner_id text,
  p_loser_id text,
  p_segment text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_winner_elo numeric := 1500;
  v_loser_elo numeric := 1500;
  v_winner_votes int := 0;
  v_loser_votes int := 0;
  v_expected numeric;
  v_winner_next numeric;
  v_loser_next numeric;
begin
  if p_segment not in ('all', 'fan', 'rival') then
    raise exception 'segment is not valid';
  end if;

  select elo, votes into v_winner_elo, v_winner_votes
  from public.watch_with_ratings
  where card_id = p_winner_id and club_slug = p_club_slug and segment = p_segment;
  if not found then
    v_winner_elo := 1500;
    v_winner_votes := 0;
  end if;

  select elo, votes into v_loser_elo, v_loser_votes
  from public.watch_with_ratings
  where card_id = p_loser_id and club_slug = p_club_slug and segment = p_segment;
  if not found then
    v_loser_elo := 1500;
    v_loser_votes := 0;
  end if;

  v_expected := 1.0 / (1.0 + power(10.0, (v_loser_elo - v_winner_elo) / 400.0));
  v_winner_next := round((v_winner_elo + 24 * (1.0 - v_expected))::numeric, 1);
  v_loser_next := round((v_loser_elo + 24 * (0.0 - (1.0 - v_expected)))::numeric, 1);

  perform public.watch_with_upsert_rating(p_winner_id, p_club_slug, p_segment, v_winner_next, v_winner_votes, true);
  perform public.watch_with_upsert_rating(p_loser_id, p_club_slug, p_segment, v_loser_next, v_loser_votes, false);
end;
$$;

create or replace function public.watch_with_record_pick(
  p_run_id uuid,
  p_session_id uuid,
  p_club_slug text,
  p_winner_id text,
  p_loser_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.watch_with_runs%rowtype;
  v_deck jsonb;
  v_len int;
  v_expected text[];
  v_challenger text;
  v_step int;
  v_now timestamptz := now();
begin
  if p_winner_id is null or p_loser_id is null or p_winner_id = p_loser_id then
    return jsonb_build_object('ok', false, 'code', 'bad-pair');
  end if;

  select * into v_run
  from public.watch_with_runs
  where id = p_run_id
    and session_id = p_session_id
    and club_slug = p_club_slug
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not-found');
  end if;

  v_deck := coalesce(v_run.deck, '[]'::jsonb);

  if v_run.completed_at is not null then
    return jsonb_build_object(
      'ok', false, 'code', 'finished', 'pick_count', v_run.pick_count,
      'deck', v_deck, 'incumbent_id', v_run.incumbent_id,
      'champion_id', v_run.champion_id, 'completed_at', v_run.completed_at
    );
  end if;

  if v_run.last_pick_at is not null
     and v_now < v_run.last_pick_at + interval '400 milliseconds' then
    return jsonb_build_object(
      'ok', false, 'code', 'too-quick', 'pick_count', v_run.pick_count,
      'deck', v_deck, 'incumbent_id', v_run.incumbent_id
    );
  end if;

  if jsonb_typeof(v_deck) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'bad-pair', 'pick_count', v_run.pick_count, 'deck', v_deck, 'incumbent_id', v_run.incumbent_id);
  end if;

  v_len := jsonb_array_length(v_deck);
  if v_len < 2 or v_run.pick_count >= v_len - 1 then
    return jsonb_build_object(
      'ok', false, 'code', 'finished', 'pick_count', v_run.pick_count,
      'deck', v_deck, 'incumbent_id', v_run.incumbent_id,
      'champion_id', v_run.champion_id, 'completed_at', v_run.completed_at
    );
  end if;

  if not exists (
    select 1 from jsonb_array_elements_text(v_deck) as d(id) where d.id = p_winner_id
  ) or not exists (
    select 1 from jsonb_array_elements_text(v_deck) as d(id) where d.id = p_loser_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'bad-pair', 'pick_count', v_run.pick_count, 'deck', v_deck, 'incumbent_id', v_run.incumbent_id);
  end if;

  if v_run.pick_count = 0 then
    v_expected := array[v_deck->>0, v_deck->>1];
  else
    if v_run.incumbent_id is null then
      return jsonb_build_object('ok', false, 'code', 'bad-pair', 'pick_count', v_run.pick_count, 'deck', v_deck, 'incumbent_id', v_run.incumbent_id);
    end if;
    v_challenger := v_deck->>(v_run.pick_count + 1);
    if v_challenger is null then
      return jsonb_build_object('ok', false, 'code', 'bad-pair', 'pick_count', v_run.pick_count, 'deck', v_deck, 'incumbent_id', v_run.incumbent_id);
    end if;
    v_expected := array[v_run.incumbent_id, v_challenger];
  end if;

  if not (
    (p_winner_id = v_expected[1] and p_loser_id = v_expected[2])
    or (p_winner_id = v_expected[2] and p_loser_id = v_expected[1])
  ) then
    return jsonb_build_object('ok', false, 'code', 'bad-pair', 'pick_count', v_run.pick_count, 'deck', v_deck, 'incumbent_id', v_run.incumbent_id);
  end if;

  v_step := v_run.pick_count + 1;

  update public.watch_with_runs
  set pick_count = v_step,
      incumbent_id = p_winner_id,
      last_pick_at = v_now
  where id = v_run.id
    and pick_count = v_run.pick_count
    and completed_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'conflict', 'pick_count', v_run.pick_count);
  end if;

  insert into public.watch_with_swipes (run_id, session_id, winner_id, loser_id, club_slug, step)
  values (v_run.id, p_session_id, p_winner_id, p_loser_id, p_club_slug, v_step);

  perform public.watch_with_apply_segment_elo(p_club_slug, p_winner_id, p_loser_id, 'all');
  if v_run.affiliation in ('fan', 'rival') then
    perform public.watch_with_apply_segment_elo(p_club_slug, p_winner_id, p_loser_id, v_run.affiliation);
  end if;

  return jsonb_build_object(
    'ok', true,
    'pick_count', v_step,
    'incumbent_id', p_winner_id,
    'deck', v_deck,
    'run_id', v_run.id,
    'affiliation', v_run.affiliation,
    'completed_at', v_run.completed_at,
    'champion_id', v_run.champion_id
  );
end;
$$;

create or replace function public.watch_with_start_run(
  p_session_id uuid,
  p_club_slug text,
  p_affiliation text,
  p_deck jsonb,
  p_day_start timestamptz,
  p_daily_cap int default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open public.watch_with_runs%rowtype;
  v_played int;
  v_created public.watch_with_runs%rowtype;
begin
  select * into v_open
  from public.watch_with_runs
  where session_id = p_session_id
    and club_slug = p_club_slug
    and completed_at is null
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'mode', 'open',
      'run', to_jsonb(v_open)
    );
  end if;

  if p_affiliation is null or p_affiliation not in ('fan', 'neutral', 'rival') then
    return jsonb_build_object('ok', true, 'mode', 'needs-affiliation');
  end if;

  if p_deck is null or jsonb_typeof(p_deck) <> 'array' or jsonb_array_length(p_deck) < 2 then
    return jsonb_build_object('ok', false, 'code', 'empty-deck');
  end if;

  select count(*)::int into v_played
  from public.watch_with_runs
  where session_id = p_session_id
    and club_slug = p_club_slug
    and completed_at is not null
    and completed_at >= p_day_start;

  if v_played >= p_daily_cap then
    return jsonb_build_object('ok', false, 'code', 'daily-cap');
  end if;

  insert into public.watch_with_runs (session_id, club_slug, deck, affiliation)
  values (p_session_id, p_club_slug, p_deck, p_affiliation)
  returning * into v_created;

  return jsonb_build_object(
    'ok', true,
    'mode', 'created',
    'run', to_jsonb(v_created)
  );
end;
$$;

revoke all on function public.watch_with_upsert_rating(text, text, text, numeric, int, boolean) from public, anon, authenticated;
grant execute on function public.watch_with_upsert_rating(text, text, text, numeric, int, boolean) to service_role;

revoke all on function public.watch_with_apply_segment_elo(text, text, text, text) from public, anon, authenticated;
grant execute on function public.watch_with_apply_segment_elo(text, text, text, text) to service_role;

revoke all on function public.watch_with_record_pick(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.watch_with_record_pick(uuid, uuid, text, text, text) to service_role;

revoke all on function public.watch_with_start_run(uuid, text, text, jsonb, timestamptz, int) from public, anon, authenticated;
grant execute on function public.watch_with_start_run(uuid, text, text, jsonb, timestamptz, int) to service_role;
