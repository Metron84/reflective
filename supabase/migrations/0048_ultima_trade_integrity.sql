-- Applied to production 4 Oct 2026. Do not re-run.
-- Ultima trade integrity (Stage A). Run after 0047_ultima_trade_block.sql.
--
-- 1. New trade states and columns.
-- 2. ultima_clear_lineup_slots: empty a player's XV slots in unscored gameweeks.
-- 3. ultima_execute_trade: one transaction that settles a trade.
--
-- Server only. Both functions are granted to service_role and nobody else.

-- ---------------------------------------------------------------------------
-- 1. States and columns
-- ---------------------------------------------------------------------------

alter table public.ultima_trades
  drop constraint if exists ultima_trades_state_check;

alter table public.ultima_trades
  add constraint ultima_trades_state_check
  check (
    state in (
      'proposed',
      'accepted',
      'declined',
      'countered',
      'cancelled',
      'review',
      'awaiting_unlock',
      'vetoed',
      'executed',
      'expired',
      'void'
    )
  );

alter table public.ultima_trades
  add column if not exists void_reason text,
  add column if not exists unlock_at timestamptz,
  add column if not exists countered_by uuid references public.ultima_trades (id);

create index if not exists ultima_trades_due_idx
  on public.ultima_trades (state, review_expires_at, unlock_at)
  where state in ('review', 'awaiting_unlock');

create index if not exists ultima_trade_players_player_idx
  on public.ultima_trade_players (player_id);

-- ---------------------------------------------------------------------------
-- 2. Empty a player's XV slots
--    Only gameweeks that are not scored yet (upcoming or live), and only where
--    the player's league has not opened its matchday. A slot in a locked
--    league keeps the player, so that gameweek's points stay with the old
--    owner. The slot row stays, with no player: an Empty slot.
-- ---------------------------------------------------------------------------

create or replace function public.ultima_clear_lineup_slots(
  p_manager_id uuid,
  p_player_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cleared integer;
begin
  update public.ultima_lineups l
  set player_id = null,
      auto_started = false,
      locked_at = null
  from public.ultima_players p,
       public.ultima_gameweeks g
  where l.manager_id = p_manager_id
    and l.player_id = any (p_player_ids)
    and p.id = l.player_id
    and g.id = l.gameweek_id
    and g.state in ('upcoming', 'live')
    and (
      g.league_open_at ->> p.league is null
      or (g.league_open_at ->> p.league)::timestamptz > now()
    );

  get diagnostics cleared = row_count;
  return cleared;
end;
$$;

revoke all on function public.ultima_clear_lineup_slots(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.ultima_clear_lineup_slots(uuid, uuid[]) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Execute a trade
--
-- Returns jsonb:
--   { ok: true,  state: 'executed' | 'awaiting_unlock' | 'vetoed' | 'void', ... }
--   { ok: false, code: 'NOT_FOUND' | 'NOT_PENDING' | 'NOT_READY' }
--
-- Every check runs before any write, so a trade that fails a check changes
-- only its own state row. The write phase raises on any surprise, which rolls
-- the whole function back: all or nothing.
--
-- Trade deadline: competition.trade_deadline_gw is the last gameweek number a
-- trade may settle in. The column defaults to 4, the opening gameweek, so a
-- value that is not above p_opens_gw means "no deadline set".
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

  -- Window and deadline, judged on the gameweek that has started most recently.
  select * into gw
  from public.ultima_gameweeks g
  where g.competition_id = t.competition_id and g.window_start <= now()
  order by g.number desc
  limit 1;

  if v_reason is null then
    if not found or gw.number < p_opens_gw then
      v_reason := 'not_open';
    elsif comp.trade_deadline_gw > p_opens_gw and gw.number > comp.trade_deadline_gw then
      v_reason := 'deadline_passed';
    end if;
  end if;

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
    and gw.league_open_at ->> p.league is not null
    and (gw.league_open_at ->> p.league)::timestamptz <= now()
    and now() < gw.window_end;

  if coalesce(array_length(locked, 1), 0) > 0 then
    unlock := case
      when (gw.window_end at time zone 'Asia/Dubai')::time = time '00:00'
        then gw.window_end
      else (((gw.window_end at time zone 'Asia/Dubai')::date + 1)::timestamp at time zone 'Asia/Dubai')
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
