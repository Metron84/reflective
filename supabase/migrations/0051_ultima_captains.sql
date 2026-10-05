-- Applied to production 5 Oct 2026. Do not re-run.
-- Ultima captains. Run after 0050_ultima_trades_open.sql. Idempotent.
--
-- One captain per country (pl, laliga, seriea, bundesliga, ligue1) per manager
-- per gameweek, chosen from that country's XV players. A captain scores x2;
-- the doubling happens server side in the scoring run, never in this file.
--
-- 1. ultima_lineups.is_captain, one per country per manager per gameweek.
-- 2. A captain needs a player. When a slot's player changes or empties
--    (bench, trade, drop, undone pick), the flag clears by itself.
-- 3. ultima_set_captain: one transaction that checks the lock and swaps the
--    captain inside a country, so a replace is a single tap and never leaves
--    two captains.
--
-- Server writes only. Participants read the flag through the existing
-- "ultima_lineups: participants read" policy, so captains are visible to all
-- managers wherever the XV is visible.

-- ---------------------------------------------------------------------------
-- 1. Column and one-per-country index
-- ---------------------------------------------------------------------------

alter table public.ultima_lineups
  add column if not exists is_captain boolean not null default false;

-- Repair before the constraints, so a re-run on dirty data cannot fail.
update public.ultima_lineups set is_captain = false where is_captain and player_id is null;

update public.ultima_lineups l
set is_captain = false
where l.is_captain
  and exists (
    select 1 from public.ultima_lineups o
    where o.manager_id = l.manager_id
      and o.gameweek_id = l.gameweek_id
      and o.slot_group = l.slot_group
      and o.is_captain
      and o.slot < l.slot
  );

alter table public.ultima_lineups
  drop constraint if exists ultima_lineups_captain_needs_player;
alter table public.ultima_lineups
  add constraint ultima_lineups_captain_needs_player
  check (not is_captain or player_id is not null);

create unique index if not exists ultima_lineups_one_captain_per_country
  on public.ultima_lineups (manager_id, gameweek_id, slot_group)
  where is_captain;

-- ---------------------------------------------------------------------------
-- 2. A captain leaves with his slot
-- ---------------------------------------------------------------------------

create or replace function public.ultima_lineups_captain_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.player_id is null
     or (tg_op = 'UPDATE' and new.player_id is distinct from old.player_id) then
    new.is_captain := false;
  end if;
  return new;
end;
$$;

drop trigger if exists ultima_lineups_captain_guard_trg on public.ultima_lineups;
create trigger ultima_lineups_captain_guard_trg
  before insert or update of player_id on public.ultima_lineups
  for each row
  execute function public.ultima_lineups_captain_guard();

-- ---------------------------------------------------------------------------
-- 3. Set a captain (replaces the old one in the same country, atomically)
-- ---------------------------------------------------------------------------

create or replace function public.ultima_set_captain(
  p_manager_id uuid,
  p_gameweek_id uuid,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  gw public.ultima_gameweeks%rowtype;
  row_ public.ultima_lineups%rowtype;
  open_at timestamptz;
  previous uuid;
begin
  select * into gw from public.ultima_gameweeks where id = p_gameweek_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NO_GAMEWEEK');
  end if;

  select * into row_
  from public.ultima_lineups
  where manager_id = p_manager_id
    and gameweek_id = p_gameweek_id
    and player_id = p_player_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_IN_XV');
  end if;

  -- Same lock as the XV slot: past the country's open time, or a live
  -- gameweek with no open time for that country.
  if gw.league_open_at ->> row_.slot_group is not null then
    open_at := (gw.league_open_at ->> row_.slot_group)::timestamptz;
    if now() >= open_at then
      return jsonb_build_object('ok', false, 'code', 'CAPTAIN_LOCKED');
    end if;
  elsif gw.state in ('live', 'provisional', 'final') then
    return jsonb_build_object('ok', false, 'code', 'CAPTAIN_LOCKED');
  end if;

  select player_id into previous
  from public.ultima_lineups
  where manager_id = p_manager_id
    and gameweek_id = p_gameweek_id
    and slot_group = row_.slot_group
    and is_captain
    and player_id <> p_player_id
  limit 1;

  -- Clear first, then set: the one-per-country index never sees two.
  update public.ultima_lineups
  set is_captain = false
  where manager_id = p_manager_id
    and gameweek_id = p_gameweek_id
    and slot_group = row_.slot_group
    and is_captain
    and player_id <> p_player_id;

  update public.ultima_lineups
  set is_captain = true
  where manager_id = p_manager_id
    and gameweek_id = p_gameweek_id
    and slot = row_.slot;

  return jsonb_build_object(
    'ok', true,
    'league', row_.slot_group,
    'player_id', p_player_id,
    'previous_player_id', previous
  );
end;
$$;

revoke all on function public.ultima_set_captain(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.ultima_set_captain(uuid, uuid, uuid) to service_role;
