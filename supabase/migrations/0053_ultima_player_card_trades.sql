-- Ultima player card, open trades and atomic signing. Run after 0052_ultima_club_sync.sql.
-- Idempotent. Server only: every function is granted to service_role and nobody else.
-- Not yet applied to production. Melo runs this in the Supabase SQL editor.
--
-- 1. ultima_execute_trade: the gameweek 4 gate is gone. Trades settle before
--    gameweek 1 and in any gameweek. Only the trade deadline can still stop one.
--    The p_opens_gw argument stays so older callers keep working. It is ignored.
-- 2. ultima_accept_trade: acceptance is atomic. The players in the deal are
--    frozen, and every other live offer that holds any of them is voided in the
--    same transaction, so two accepts can never both win a player.
-- 3. ultima_expire_trades: live offers nobody answered in 48 hours expire.
-- 4. ultima_sign_player: sign a free agent and release a player in one
--    transaction. The roster unique index decides a race, first commit wins.
-- 5. Guards: at most 3 live outgoing offers per manager, and one live offer
--    between the same two managers.
--
-- "Live" means proposed and not yet accepted. "Accepted" means review or
-- awaiting_unlock. Only accepted offers freeze players.

-- ---------------------------------------------------------------------------
-- 0. Helper: is a slot's country locked in a gameweek
-- ---------------------------------------------------------------------------

create or replace function public.ultima_slot_locked(
  p_open_at jsonb,
  p_state text,
  p_slot_group text
)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when p_open_at ->> p_slot_group is not null
      then (p_open_at ->> p_slot_group)::timestamptz <= now()
    else p_state in ('live', 'provisional', 'final')
  end
$$;

revoke all on function public.ultima_slot_locked(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.ultima_slot_locked(jsonb, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 1. Execute a trade (replaces the 0050 definition; only the gate changes)
-- ---------------------------------------------------------------------------

create or replace function public.ultima_execute_trade(
  p_trade_id uuid,
  p_opens_gw integer default 0,
  p_squad_size integer default 30,
  p_floor integer default 3
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.ultima_trades%rowtype;
  comp public.ultima_competition%rowtype;
  gw public.ultima_gameweeks%rowtype;
  gw_now public.ultima_gameweeks%rowtype;
  ref_time timestamptz;
  leagues text[] := array['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1'];
  lg text;
  mid uuid;
  total_rows integer;
  owned_rows integer;
  n_others integer;
  n_vetoes integer;
  majority integer;
  before_n integer;
  after_n integer;
  league_n integer;
  moved integer;
  locked text[];
  unlock timestamptz;
  v_reason text;
  void_detail jsonb := '{}'::jsonb;
  voided uuid[] := '{}';
  other record;
begin
  select * into t from public.ultima_trades where id = p_trade_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if t.state not in ('review', 'awaiting_unlock') then
    return jsonb_build_object('ok', false, 'code', 'NOT_PENDING', 'state', t.state);
  end if;

  if t.state = 'review' and t.review_expires_at is not null and t.review_expires_at > now() then
    return jsonb_build_object('ok', false, 'code', 'NOT_READY', 'ready_at', t.review_expires_at);
  end if;

  if t.state = 'awaiting_unlock' and t.unlock_at is not null and t.unlock_at > now() then
    return jsonb_build_object('ok', false, 'code', 'NOT_READY', 'ready_at', t.unlock_at);
  end if;

  select * into comp from public.ultima_competition where id = t.competition_id;

  -- Lock both squads and every player in the deal, in a stable order.
  perform 1
  from public.ultima_rosters r
  where r.manager_id in (t.proposer_id, t.receiver_id)
     or r.player_id in (select player_id from public.ultima_trade_players where trade_id = t.id)
  order by r.manager_id, r.player_id
  for update;

  -- Veto majority, re-counted from the votes table: other human managers only.
  select count(*) into n_others
  from public.ultima_managers m
  where m.competition_id = t.competition_id
    and m.is_bot = false
    and m.id not in (t.proposer_id, t.receiver_id);

  select count(*) into n_vetoes
  from public.ultima_trade_votes v
  join public.ultima_managers m on m.id = v.manager_id
  where v.trade_id = t.id
    and v.veto
    and m.is_bot = false
    and m.id not in (t.proposer_id, t.receiver_id);

  majority := n_others / 2 + 1;
  if n_vetoes > 0 and n_vetoes >= majority then
    update public.ultima_trades
    set state = 'vetoed', resolved_at = now()
    where id = t.id;
    insert into public.ultima_events (event, manager_id, competition_id, payload)
    values ('trade_vetoed', null, t.competition_id,
            jsonb_build_object('trade_id', t.id, 'votes', n_vetoes));
    return jsonb_build_object('ok', true, 'state', 'vetoed', 'votes', n_vetoes);
  end if;

  -- Checks. The first failure voids the trade.
  select count(*) into total_rows from public.ultima_trade_players where trade_id = t.id;

  select count(*) into owned_rows
  from public.ultima_trade_players tp
  join public.ultima_rosters r
    on r.player_id = tp.player_id and r.manager_id = tp.from_manager_id
  where tp.trade_id = t.id;

  if total_rows = 0 then
    v_reason := 'empty';
  elsif owned_rows <> total_rows then
    v_reason := 'ownership_changed';
  elsif exists (
    select 1 from public.ultima_managers m
    where m.id in (t.proposer_id, t.receiver_id) and m.is_bot
  ) then
    v_reason := 'bot_manager';
  end if;

  -- Window and deadline are judged on the gameweek the review ended in, so a
  -- trade that cleared review before the deadline is not voided because the
  -- settling job ran late. A held trade is judged now.
  ref_time := case
    when t.state = 'review' and t.review_expires_at is not null
      then least(t.review_expires_at, now())
    else now()
  end;

  select * into gw
  from public.ultima_gameweeks g
  where g.competition_id = t.competition_id and g.window_start <= ref_time
  order by g.number desc
  limit 1;

  -- No opening gameweek any more: trades settle before gameweek 1 as well.
  -- Only the deadline can stop a trade on the gameweek the review ended in.
  if v_reason is null then
    if gw.number is not null
       and comp.trade_deadline_gw is not null
       and gw.number > comp.trade_deadline_gw then
      v_reason := 'deadline_passed';
    end if;
  end if;

  -- Locks are judged on the gameweek that is running now.
  select * into gw_now
  from public.ultima_gameweeks g
  where g.competition_id = t.competition_id and g.window_start <= now()
  order by g.number desc
  limit 1;

  -- Squad size and league floors after the swap, for both managers.
  if v_reason is null then
    foreach mid in array array[t.proposer_id, t.receiver_id] loop
      select count(*) into before_n from public.ultima_rosters where manager_id = mid;
      select before_n
             - count(*) filter (where tp.from_manager_id = mid)
             + count(*) filter (where tp.to_manager_id = mid)
      into after_n
      from public.ultima_trade_players tp
      where tp.trade_id = t.id;

      if after_n <> before_n or after_n > p_squad_size then
        v_reason := 'squad_size';
        void_detail := jsonb_build_object('manager_id', mid, 'count', after_n);
        exit;
      end if;

      foreach lg in array leagues loop
        select
          (select count(*) from public.ultima_rosters r
             join public.ultima_players p on p.id = r.player_id
             where r.manager_id = mid and p.league = lg)
          - (select count(*) from public.ultima_trade_players tp
               join public.ultima_players p on p.id = tp.player_id
               where tp.trade_id = t.id and tp.from_manager_id = mid and p.league = lg)
          + (select count(*) from public.ultima_trade_players tp
               join public.ultima_players p on p.id = tp.player_id
               where tp.trade_id = t.id and tp.to_manager_id = mid and p.league = lg)
        into league_n;

        if league_n < p_floor then
          v_reason := 'floor';
          void_detail := jsonb_build_object('manager_id', mid, 'league', lg, 'count', league_n);
          exit;
        end if;
      end loop;

      exit when v_reason is not null;
    end loop;
  end if;

  if v_reason is not null then
    update public.ultima_trades
    set state = 'void', void_reason = v_reason, resolved_at = now()
    where id = t.id;
    insert into public.ultima_events (event, manager_id, competition_id, payload)
    values ('trade_void', t.proposer_id, t.competition_id,
            jsonb_build_object('trade_id', t.id, 'reason', v_reason) || void_detail);
    return jsonb_build_object('ok', true, 'state', 'void', 'reason', v_reason, 'detail', void_detail);
  end if;

  -- Lock check: any traded player in a league that has opened this gameweek
  -- holds the whole trade until the next Friday 00:00 Gulf time.
  select coalesce(array_agg(distinct p.league), '{}') into locked
  from public.ultima_trade_players tp
  join public.ultima_players p on p.id = tp.player_id
  where tp.trade_id = t.id
    and (
      (gw_now.league_open_at ->> p.league is not null
        and (gw_now.league_open_at ->> p.league)::timestamptz <= now())
      or (gw_now.league_open_at ->> p.league is null and gw_now.state = 'live')
    )
    and now() < gw_now.window_end;

  if coalesce(array_length(locked, 1), 0) > 0 then
    unlock := case
      when (gw_now.window_end at time zone 'Asia/Dubai')::time = time '00:00'
        then gw_now.window_end
      else (((gw_now.window_end at time zone 'Asia/Dubai')::date + 1)::timestamp at time zone 'Asia/Dubai')
    end;

    update public.ultima_trades
    set state = 'awaiting_unlock', unlock_at = unlock
    where id = t.id;

    if t.state = 'review' then
      insert into public.ultima_events (event, manager_id, competition_id, payload)
      values ('trade_awaiting_unlock', null, t.competition_id,
              jsonb_build_object('trade_id', t.id, 'leagues', to_jsonb(locked), 'unlock_at', unlock));
    end if;

    return jsonb_build_object('ok', true, 'state', 'awaiting_unlock',
                              'unlock_at', unlock, 'leagues', to_jsonb(locked));
  end if;

  -- Write phase. Anything unexpected raises and rolls back everything above.
  update public.ultima_rosters r
  set manager_id = tp.to_manager_id,
      acquired_at = now()
  from public.ultima_trade_players tp
  where tp.trade_id = t.id
    and r.player_id = tp.player_id
    and r.manager_id = tp.from_manager_id;

  get diagnostics moved = row_count;
  if moved <> total_rows then
    raise exception 'ultima_execute_trade %: moved % of % players', t.id, moved, total_rows;
  end if;

  for mid in
    select distinct from_manager_id from public.ultima_trade_players where trade_id = t.id
  loop
    perform public.ultima_clear_lineup_slots(
      mid,
      (select array_agg(player_id) from public.ultima_trade_players
        where trade_id = t.id and from_manager_id = mid)
    );
  end loop;

  -- Every other pending trade that shares a player can no longer happen.
  for other in
    update public.ultima_trades o
    set state = 'void', void_reason = 'player_traded', resolved_at = now()
    where o.id <> t.id
      and o.state in ('proposed', 'review', 'awaiting_unlock')
      and exists (
        select 1
        from public.ultima_trade_players a
        join public.ultima_trade_players b on b.player_id = a.player_id
        where a.trade_id = o.id and b.trade_id = t.id
      )
    returning o.id, o.proposer_id, o.competition_id
  loop
    voided := voided || other.id;
    insert into public.ultima_events (event, manager_id, competition_id, payload)
    values ('trade_void', other.proposer_id, other.competition_id,
            jsonb_build_object('trade_id', other.id, 'reason', 'player_traded', 'by_trade', t.id));
  end loop;

  update public.ultima_trades
  set state = 'executed', resolved_at = now()
  where id = t.id;

  insert into public.ultima_events (event, manager_id, competition_id, payload)
  values ('trade_executed', null, t.competition_id, jsonb_build_object('trade_id', t.id));

  return jsonb_build_object('ok', true, 'state', 'executed', 'voided', to_jsonb(voided));
end;
$$;

revoke all on function public.ultima_execute_trade(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.ultima_execute_trade(uuid, integer, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Accept a trade, atomically
--
-- Returns { ok, state, review_expires_at, voided: [ { trade_id, proposer_id,
-- receiver_id } ] } or { ok: false, code } with one of NOT_FOUND, NOT_RECEIVER,
-- NOT_OPEN, EXPIRED, OWNERSHIP, PLAYER_FROZEN.
--
-- Every roster row in the deal is locked first, in player id order. Two
-- accepts that share a player queue on that row. The second one then finds its
-- offer already voided, or finds the player frozen, and stops.
-- ---------------------------------------------------------------------------

create or replace function public.ultima_accept_trade(
  p_trade_id uuid,
  p_manager_id uuid,
  p_review_hours integer default 24,
  p_live_hours integer default 48
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.ultima_trades%rowtype;
  total_rows integer;
  owned_rows integer;
  frozen_id uuid;
  frozen_name text;
  review_at timestamptz;
  other record;
  voided jsonb := '[]'::jsonb;
begin
  perform 1
  from public.ultima_rosters r
  where r.player_id in (select player_id from public.ultima_trade_players where trade_id = p_trade_id)
  order by r.player_id
  for update;

  select * into t from public.ultima_trades where id = p_trade_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if t.receiver_id <> p_manager_id then
    return jsonb_build_object('ok', false, 'code', 'NOT_RECEIVER');
  end if;

  if t.state <> 'proposed' then
    return jsonb_build_object('ok', false, 'code', 'NOT_OPEN', 'state', t.state);
  end if;

  if t.created_at <= now() - make_interval(hours => p_live_hours) then
    update public.ultima_trades set state = 'expired', resolved_at = now() where id = t.id;
    insert into public.ultima_events (event, manager_id, competition_id, payload)
    values ('trade_expired', t.proposer_id, t.competition_id, jsonb_build_object('trade_id', t.id));
    return jsonb_build_object('ok', false, 'code', 'EXPIRED');
  end if;

  select count(*) into total_rows from public.ultima_trade_players where trade_id = t.id;
  select count(*) into owned_rows
  from public.ultima_trade_players tp
  join public.ultima_rosters r
    on r.player_id = tp.player_id and r.manager_id = tp.from_manager_id
  where tp.trade_id = t.id;

  if total_rows = 0 or owned_rows <> total_rows then
    update public.ultima_trades
    set state = 'void', void_reason = 'ownership_changed', resolved_at = now()
    where id = t.id;
    insert into public.ultima_events (event, manager_id, competition_id, payload)
    values ('trade_void', t.proposer_id, t.competition_id,
            jsonb_build_object('trade_id', t.id, 'reason', 'ownership_changed'));
    return jsonb_build_object('ok', false, 'code', 'OWNERSHIP');
  end if;

  select tp.player_id, p.name into frozen_id, frozen_name
  from public.ultima_trade_players tp
  join public.ultima_trades o on o.id = tp.trade_id
  join public.ultima_players p on p.id = tp.player_id
  where o.id <> t.id
    and o.state in ('review', 'awaiting_unlock')
    and tp.player_id in (select player_id from public.ultima_trade_players where trade_id = t.id)
  limit 1;

  if frozen_id is not null then
    update public.ultima_trades
    set state = 'void', void_reason = 'player_in_accepted_deal', resolved_at = now()
    where id = t.id;
    insert into public.ultima_events (event, manager_id, competition_id, payload)
    values ('trade_void', t.proposer_id, t.competition_id,
            jsonb_build_object('trade_id', t.id, 'reason', 'player_in_accepted_deal'));
    return jsonb_build_object('ok', false, 'code', 'PLAYER_FROZEN',
                              'player_id', frozen_id, 'player_name', frozen_name);
  end if;

  review_at := now() + make_interval(hours => p_review_hours);

  update public.ultima_trades
  set state = 'review', review_expires_at = review_at
  where id = t.id;

  insert into public.ultima_events (event, manager_id, competition_id, payload)
  values ('trade_review', p_manager_id, t.competition_id, jsonb_build_object('trade_id', t.id));

  -- Freeze: every other live offer that holds any of these players is void now.
  for other in
    update public.ultima_trades o
    set state = 'void', void_reason = 'player_in_accepted_deal', resolved_at = now()
    where o.id <> t.id
      and o.state = 'proposed'
      and exists (
        select 1
        from public.ultima_trade_players a
        join public.ultima_trade_players b on b.player_id = a.player_id
        where a.trade_id = o.id and b.trade_id = t.id
      )
    returning o.id, o.proposer_id, o.receiver_id, o.competition_id
  loop
    insert into public.ultima_events (event, manager_id, competition_id, payload)
    values ('trade_void', other.proposer_id, other.competition_id,
            jsonb_build_object('trade_id', other.id, 'reason', 'player_in_accepted_deal', 'by_trade', t.id));
    voided := voided || jsonb_build_array(jsonb_build_object(
      'trade_id', other.id,
      'proposer_id', other.proposer_id,
      'receiver_id', other.receiver_id
    ));
  end loop;

  return jsonb_build_object('ok', true, 'state', 'review',
                            'review_expires_at', review_at, 'voided', voided);
end;
$$;

revoke all on function public.ultima_accept_trade(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.ultima_accept_trade(uuid, uuid, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Expire unanswered live offers
-- ---------------------------------------------------------------------------

create or replace function public.ultima_expire_trades(p_hours integer default 48)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  expired jsonb := '[]'::jsonb;
begin
  for rec in
    update public.ultima_trades t
    set state = 'expired', resolved_at = now()
    where t.state = 'proposed'
      and t.created_at <= now() - make_interval(hours => p_hours)
    returning t.id, t.competition_id, t.proposer_id, t.receiver_id
  loop
    insert into public.ultima_events (event, manager_id, competition_id, payload)
    values ('trade_expired', rec.proposer_id, rec.competition_id,
            jsonb_build_object('trade_id', rec.id));
    expired := expired || jsonb_build_array(jsonb_build_object(
      'trade_id', rec.id,
      'proposer_id', rec.proposer_id,
      'receiver_id', rec.receiver_id
    ));
  end loop;
  return jsonb_build_object('expired', expired);
end;
$$;

revoke all on function public.ultima_expire_trades(integer) from public, anon, authenticated;
grant execute on function public.ultima_expire_trades(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Sign a free agent and release a player, atomically
--
-- Returns { ok: true, voided: [ { trade_id, other_manager_id } ] } or
-- { ok: false, code } with one of UNAVAILABLE, NOT_OWNED, IN_ACCEPTED_TRADE,
-- XV_LOCKED, SQUAD_FULL, PICK_TAKEN (with taken_by), FLOOR_VIOLATION (with
-- league). Releasing an XV player empties that slot. Releasing a captain
-- clears the captaincy (the 0051 trigger does it when the slot empties).
-- A player signed after his country locked is simply not in any XV: the bench.
-- ---------------------------------------------------------------------------

create or replace function public.ultima_sign_player(
  p_manager_id uuid,
  p_add_player_id uuid,
  p_drop_player_id uuid default null,
  p_gameweek_id uuid default null,
  p_squad_size integer default 30,
  p_floor integer default 3
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mgr public.ultima_managers%rowtype;
  addp public.ultima_players%rowtype;
  dropp public.ultima_players%rowtype;
  leagues text[] := array['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1'];
  lg text;
  n integer;
  before_n integer;
  after_n integer;
  owner_team text;
  voided jsonb := '[]'::jsonb;
  void_res jsonb;
begin
  select * into mgr from public.ultima_managers where id = p_manager_id for update;
  if not found or mgr.is_bot then
    return jsonb_build_object('ok', false, 'code', 'UNAVAILABLE');
  end if;

  select * into addp from public.ultima_players where id = p_add_player_id;
  if not found or not addp.active then
    return jsonb_build_object('ok', false, 'code', 'UNAVAILABLE');
  end if;

  if p_drop_player_id is not null then
    perform 1 from public.ultima_rosters
    where manager_id = p_manager_id and player_id = p_drop_player_id
    for update;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'NOT_OWNED');
    end if;
    select * into dropp from public.ultima_players where id = p_drop_player_id;

    if exists (
      select 1
      from public.ultima_trade_players tp
      join public.ultima_trades o on o.id = tp.trade_id
      where tp.player_id = p_drop_player_id
        and o.state in ('review', 'awaiting_unlock')
    ) then
      return jsonb_build_object('ok', false, 'code', 'IN_ACCEPTED_TRADE');
    end if;

    if exists (
      select 1
      from public.ultima_lineups l
      join public.ultima_gameweeks g on g.id = l.gameweek_id
      where l.manager_id = p_manager_id
        and l.player_id = p_drop_player_id
        and g.window_start <= now()
        and now() < g.window_end
        and public.ultima_slot_locked(g.league_open_at, g.state, l.slot_group)
    ) then
      return jsonb_build_object('ok', false, 'code', 'XV_LOCKED');
    end if;
  end if;

  select count(*) into n from public.ultima_rosters where manager_id = p_manager_id;
  if p_drop_player_id is null and n >= p_squad_size then
    return jsonb_build_object('ok', false, 'code', 'SQUAD_FULL');
  end if;

  -- A floor gap that already exists is not made worse.
  foreach lg in array leagues loop
    select count(*) into before_n
    from public.ultima_rosters r
    join public.ultima_players p on p.id = r.player_id
    where r.manager_id = p_manager_id and p.league = lg;

    after_n := before_n
      + case when addp.league = lg then 1 else 0 end
      - case when dropp.league is not null and dropp.league = lg then 1 else 0 end;

    if greatest(0, p_floor - after_n) > greatest(0, p_floor - before_n) then
      return jsonb_build_object('ok', false, 'code', 'FLOOR_VIOLATION', 'league', lg, 'count', after_n);
    end if;
  end loop;

  -- The unique index on (competition_id, player_id) decides a race.
  begin
    insert into public.ultima_rosters (manager_id, player_id)
    values (p_manager_id, p_add_player_id);
  exception when unique_violation then
    select m.team_name into owner_team
    from public.ultima_rosters r
    join public.ultima_managers m on m.id = r.manager_id
    where r.player_id = p_add_player_id
    limit 1;
    return jsonb_build_object('ok', false, 'code', 'PICK_TAKEN', 'taken_by', owner_team);
  end;

  if p_drop_player_id is not null then
    delete from public.ultima_rosters
    where manager_id = p_manager_id and player_id = p_drop_player_id;

    -- Empty the slot in every gameweek that is not scored and not locked.
    update public.ultima_lineups l
    set player_id = null, auto_started = false, locked_at = null
    from public.ultima_gameweeks g
    where l.manager_id = p_manager_id
      and l.player_id = p_drop_player_id
      and g.id = l.gameweek_id
      and g.state in ('upcoming', 'live')
      and not public.ultima_slot_locked(g.league_open_at, g.state, l.slot_group);

    -- Live offers that hold the released player are void. Accepted ones were refused above.
    void_res := public.ultima_void_trades_for_players(p_manager_id, array[p_drop_player_id], 'player_released');
    voided := coalesce(void_res -> 'voided', '[]'::jsonb);

    insert into public.ultima_transactions (manager_id, type, player_id, gameweek_id)
    values (p_manager_id, 'drop', p_drop_player_id, p_gameweek_id);

    insert into public.ultima_transactions (manager_id, type, player_id, related_player_id, gameweek_id)
    values (p_manager_id, 'add', p_add_player_id, p_drop_player_id, p_gameweek_id);
  end if;

  -- Eligibility is fixed at signing: an undrafted free agent is Bolt eligible.
  update public.ultima_players
  set draft_round = null, bolt_eligible = true
  where id = p_add_player_id;

  insert into public.ultima_events (event, manager_id, competition_id, payload)
  values ('market_add', p_manager_id, mgr.competition_id,
          jsonb_build_object('add', p_add_player_id, 'drop', p_drop_player_id));

  if p_drop_player_id is not null then
    insert into public.ultima_events (event, manager_id, competition_id, payload)
    values ('market_release', p_manager_id, mgr.competition_id,
            jsonb_build_object('player_id', p_drop_player_id, 'for_player_id', p_add_player_id));
  end if;

  return jsonb_build_object('ok', true, 'voided', voided);
end;
$$;

revoke all on function public.ultima_sign_player(uuid, uuid, uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.ultima_sign_player(uuid, uuid, uuid, uuid, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Guards on live offers
-- ---------------------------------------------------------------------------

-- At most 3 live outgoing offers per manager. The advisory lock makes two
-- sends at the same moment queue, so the cap cannot be beaten by a race.
create or replace function public.ultima_trades_live_cap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.state = 'proposed' then
    perform pg_advisory_xact_lock(hashtextextended(new.proposer_id::text, 53));
    if (
      select count(*) from public.ultima_trades
      where proposer_id = new.proposer_id and state = 'proposed'
    ) >= 3 then
      raise exception 'trade_live_cap' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ultima_trades_live_cap_trg on public.ultima_trades;
create trigger ultima_trades_live_cap_trg
  before insert on public.ultima_trades
  for each row execute function public.ultima_trades_live_cap();

-- One live offer between the same two managers, in either direction.
do $$
begin
  if exists (
    select 1
    from public.ultima_trades
    where state = 'proposed'
    group by least(proposer_id, receiver_id), greatest(proposer_id, receiver_id)
    having count(*) > 1
  ) then
    raise exception 'ultima_trades: two live offers already exist between the same managers. Withdraw one, then run this again.';
  end if;
end $$;

create unique index if not exists ultima_trades_one_live_per_pair
  on public.ultima_trades (least(proposer_id, receiver_id), greatest(proposer_id, receiver_id))
  where state = 'proposed';
