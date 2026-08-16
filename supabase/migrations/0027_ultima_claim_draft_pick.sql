-- Atomic draft claim: lock the clock, refuse taken players, write pick + roster + advance.
-- Run after 0026_ultima_practice_keep_and_chat.sql.

create or replace function public.ultima_claim_draft_pick(
  p_competition_id uuid,
  p_manager_id uuid,
  p_player_id uuid,
  p_expected_pick integer,
  p_round integer,
  p_auto_picked boolean default false,
  p_forced boolean default false,
  p_forced_league text default null,
  p_rationale text default null,
  p_timer_seconds integer default 60,
  p_total_picks integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  st public.ultima_draft_state%rowtype;
  next_pick integer;
  next_expires timestamptz;
  next_state text;
begin
  select *
  into st
  from public.ultima_draft_state
  where competition_id = p_competition_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'UNAVAILABLE',
      'message', format('No draft state for competition. player=%s pick=%s', p_player_id, p_expected_pick)
    );
  end if;

  if st.state is distinct from 'live' then
    return jsonb_build_object(
      'ok', false,
      'code', 'NOT_YOUR_TURN',
      'message', format('Draft is not live. player=%s pick=%s', p_player_id, p_expected_pick)
    );
  end if;

  if st.current_pick is distinct from p_expected_pick then
    return jsonb_build_object(
      'ok', false,
      'code', 'PICK_TAKEN',
      'message', format(
        'Clock moved before insert. expected_pick=%s actual_pick=%s player=%s',
        p_expected_pick,
        st.current_pick,
        p_player_id
      )
    );
  end if;

  if exists (
    select 1
    from public.ultima_draft_picks
    where competition_id = p_competition_id
      and player_id = p_player_id
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'PICK_TAKEN',
      'message', format('Player already drafted. player=%s pick=%s', p_player_id, p_expected_pick)
    );
  end if;

  insert into public.ultima_draft_picks (
    competition_id,
    manager_id,
    player_id,
    round,
    pick_number,
    auto_picked,
    forced,
    forced_league,
    rationale
  ) values (
    p_competition_id,
    p_manager_id,
    p_player_id,
    p_round,
    p_expected_pick,
    p_auto_picked,
    p_forced,
    p_forced_league,
    p_rationale
  );

  insert into public.ultima_rosters (
    competition_id,
    manager_id,
    player_id
  ) values (
    p_competition_id,
    p_manager_id,
    p_player_id
  );

  next_pick := p_expected_pick + 1;
  if next_pick > p_total_picks then
    next_state := 'complete';
    next_expires := null;
  else
    next_state := 'live';
    next_expires := now() + make_interval(secs => greatest(p_timer_seconds, 1));
  end if;

  update public.ultima_draft_state
  set
    state = next_state,
    current_pick = next_pick,
    turn_expires_at = next_expires,
    completed_at = case when next_state = 'complete' then now() else completed_at end
  where competition_id = p_competition_id;

  return jsonb_build_object(
    'ok', true,
    'pickNumber', p_expected_pick,
    'nextPick', next_pick,
    'complete', next_pick > p_total_picks
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'ok', false,
      'code', 'PICK_TAKEN',
      'message', format('Unique conflict on claim. player=%s pick=%s', p_player_id, p_expected_pick)
    );
  when others then
    return jsonb_build_object(
      'ok', false,
      'code', 'UNAVAILABLE',
      'message', format('Claim failed: %s. player=%s pick=%s', SQLERRM, p_player_id, p_expected_pick)
    );
end;
$$;

revoke all on function public.ultima_claim_draft_pick(
  uuid, uuid, uuid, integer, integer, boolean, boolean, text, text, integer, integer
) from public;

grant execute on function public.ultima_claim_draft_pick(
  uuid, uuid, uuid, integer, integer, boolean, boolean, text, text, integer, integer
) to service_role;
