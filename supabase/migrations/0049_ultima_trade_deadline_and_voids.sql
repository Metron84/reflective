-- Applied to production 4 Oct 2026. Do not re-run.
-- Ultima trade deadline and pending-trade voids. Run after 0048_ultima_trade_integrity.sql.
--
-- 1. trade_deadline_gw: null means no deadline. The old default of 4 is cleared.
-- 2. ultima_execute_trade: no "4 or lower means none" rule. The window and
--    deadline are judged on the gameweek the review ended in, and locks on the
--    gameweek running now.
-- 3. ultima_void_trades_for_players: voids a manager's pending trades that
--    include a player who is leaving the squad (drop, add with drop, undone pick).
--
-- Server only. Granted to service_role and nobody else.

-- ---------------------------------------------------------------------------
-- 1. Deadline column
-- ---------------------------------------------------------------------------

alter table public.ultima_competition
  alter column trade_deadline_gw drop not null,
  alter column trade_deadline_gw drop default;

-- The default of 4 was never a chosen deadline. Clear it so no season starts
-- with trades closing after gameweek 4.
update public.ultima_competition
set trade_deadline_gw = null
where trade_deadline_gw = 4;

-- ---------------------------------------------------------------------------
-- 2. Execute a trade (replaces the 0048 definition)
-- ---------------------------------------------------------------------------

create or replace function public.ultima_execute_trade(
  p_trade_id uuid,
  p_opens_gw integer default 4,
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

  if v_reason is null then
    if not found or gw.number < p_opens_gw then
      v_reason := 'not_open';
    elsif comp.trade_deadline_gw is not null and gw.number > comp.trade_deadline_gw then
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
    and gw_now.league_open_at ->> p.league is not null
    and (gw_now.league_open_at ->> p.league)::timestamptz <= now()
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
-- 3. Void pending trades that include players who are leaving a squad
--
-- Only the giving side counts: a manager cannot drop a player who belongs to
-- someone else. Returns { voided: [ { trade_id, other_manager_id } ] }.
-- ---------------------------------------------------------------------------

create or replace function public.ultima_void_trades_for_players(
  p_manager_id uuid,
  p_player_ids uuid[],
  p_reason text default 'player_dropped'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  voided jsonb := '[]'::jsonb;
begin
  for rec in
    update public.ultima_trades t
    set state = 'void', void_reason = p_reason, resolved_at = now()
    where t.state in ('proposed', 'review', 'awaiting_unlock')
      and exists (
        select 1
        from public.ultima_trade_players tp
        where tp.trade_id = t.id
          and tp.from_manager_id = p_manager_id
          and tp.player_id = any (p_player_ids)
      )
    returning t.id, t.competition_id, t.proposer_id, t.receiver_id
  loop
    insert into public.ultima_events (event, manager_id, competition_id, payload)
    values ('trade_void', p_manager_id, rec.competition_id,
            jsonb_build_object('trade_id', rec.id, 'reason', p_reason));

    voided := voided || jsonb_build_array(jsonb_build_object(
      'trade_id', rec.id,
      'other_manager_id',
      case when rec.proposer_id = p_manager_id then rec.receiver_id else rec.proposer_id end
    ));
  end loop;

  return jsonb_build_object('voided', voided);
end;
$$;

revoke all on function public.ultima_void_trades_for_players(uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.ultima_void_trades_for_players(uuid, uuid[], text) to service_role;
