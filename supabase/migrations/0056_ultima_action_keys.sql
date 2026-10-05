-- Ultima action keys and a stricter free agent claim.
-- Run after 0055_ultima_notifications_inbox.sql (0055 may still be pending; this file does not depend on it).
-- NOT YET APPLIED. Melo runs this in the Supabase SQL editor.
--
-- 1. ultima_action_keys: one row per write tap. The browser sends an
--    Idempotency-Key header. The first request claims the key, runs, then
--    stores its result. A repeated key returns the stored result and writes
--    nothing. result is null while the first request is still running.
-- 2. ultima_sign_player: same function as 0053 with the claim pattern of
--    ultima_claim_draft_pick. The free agent's row is locked FOR UPDATE, an
--    existing owner is refused before any write, and the refusal says who has
--    him and when (taken_by, taken_at). ALREADY_YOURS is new.
--    BEFORE RUNNING: this replaces the function body. If the production copy was
--    edited after 0053, diff it against 0053 and carry those edits into this file.

-- ---------------------------------------------------------------------------
-- 1. Action keys
-- ---------------------------------------------------------------------------

create table if not exists public.ultima_action_keys (
  key text not null check (char_length(key) between 8 and 80),
  manager_id uuid not null references public.ultima_managers (id) on delete cascade,
  route text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (manager_id, key)
);

create index if not exists ultima_action_keys_created_idx
  on public.ultima_action_keys (created_at);

alter table public.ultima_action_keys enable row level security;

-- Server only (service role). No policies: the browser never reads this table.
revoke all on public.ultima_action_keys from anon, authenticated;

-- Keys are only useful for a short while. The server calls this now and then.
create or replace function public.ultima_purge_action_keys(p_days integer default 7)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.ultima_action_keys
  where created_at < now() - make_interval(days => greatest(p_days, 1));
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.ultima_purge_action_keys(integer) from public, anon, authenticated;
grant execute on function public.ultima_purge_action_keys(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Sign a free agent and release a player, atomically
--
-- Returns { ok: true, voided: [ { trade_id, other_manager_id } ] } or
-- { ok: false, code } with one of UNAVAILABLE, NOT_OWNED, IN_ACCEPTED_TRADE,
-- XV_LOCKED, SQUAD_FULL, ALREADY_YOURS, PICK_TAKEN (with taken_by and
-- taken_at), FLOOR_VIOLATION (with league and count).
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
  owner_id uuid;
  owner_at timestamptz;
  voided jsonb := '[]'::jsonb;
  void_res jsonb;
begin
  select * into mgr from public.ultima_managers where id = p_manager_id for update;
  if not found or mgr.is_bot then
    return jsonb_build_object('ok', false, 'code', 'UNAVAILABLE');
  end if;

  -- Claim pattern, as in ultima_claim_draft_pick: lock the free agent's row
  -- first, so two signings for him queue here and the second one reads the
  -- first one's committed roster row. The manager row is locked above, the
  -- player row here and the roster rows after, in that order everywhere.
  select * into addp from public.ultima_players where id = p_add_player_id for update;
  if not found or not addp.active or coalesce(addp.inactive_flag, false) then
    return jsonb_build_object('ok', false, 'code', 'UNAVAILABLE');
  end if;

  select r.manager_id, m.team_name, r.acquired_at
  into owner_id, owner_team, owner_at
  from public.ultima_rosters r
  join public.ultima_managers m on m.id = r.manager_id
  where r.player_id = p_add_player_id
  limit 1;
  if found then
    if owner_id = p_manager_id then
      return jsonb_build_object('ok', false, 'code', 'ALREADY_YOURS');
    end if;
    return jsonb_build_object('ok', false, 'code', 'PICK_TAKEN',
                              'taken_by', owner_team, 'taken_at', owner_at);
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
    select m.team_name, r.acquired_at into owner_team, owner_at
    from public.ultima_rosters r
    join public.ultima_managers m on m.id = r.manager_id
    where r.player_id = p_add_player_id
    limit 1;
    return jsonb_build_object('ok', false, 'code', 'PICK_TAKEN',
                              'taken_by', owner_team, 'taken_at', owner_at);
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
  -- A drafted player who is re-signed keeps his draft_round and his status.
  update public.ultima_players
  set bolt_eligible = true
  where id = p_add_player_id and draft_round is null;

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
