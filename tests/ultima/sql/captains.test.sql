-- Tests for captains (migration 0051): one per country, clear on leave, lock, replace.
-- Each scenario runs in its own transaction and is rolled back.

create schema tc;

create function tc.assert(c boolean, m text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FAIL: %', m; end if;
end $$;

-- One manager, a gameweek, and an XV of 3 players in each league (slots 1..15).
create function tc.setup(open_pl timestamptz default now() + interval '2 days',
                         gw_state text default 'upcoming', open_all boolean default true)
returns void language plpgsql as $$
declare comp uuid; m uuid; pid uuid; gw uuid; lg text; i int; s int := 0; opens jsonb;
begin
  insert into public.ultima_competition (season_label) values ('tc') returning id into comp;
  insert into public.ultima_managers (competition_id, team_name, manager_name, colour)
  values (comp, 'TeamC', 'MgrC', 'slate') returning id into m;
  opens := case when open_all then
    jsonb_build_object('pl', open_pl, 'laliga', now() + interval '2 days', 'seriea', now() + interval '2 days',
                       'bundesliga', now() + interval '2 days', 'ligue1', now() + interval '2 days')
    else '{}'::jsonb end;
  insert into public.ultima_gameweeks (competition_id, number, window_start, window_end, state, league_open_at)
  values (comp, 1, now() - interval '1 day', now() + interval '5 days', gw_state, opens) returning id into gw;
  foreach lg in array array['pl','laliga','seriea','bundesliga','ligue1'] loop
    for i in 1..3 loop
      s := s + 1;
      insert into public.ultima_players (provider_id, name, league, club)
      values (lg || i, lg || '-' || i, lg, 'C') returning id into pid;
      insert into public.ultima_rosters (manager_id, player_id) values (m, pid);
      insert into public.ultima_lineups (manager_id, gameweek_id, slot, slot_group, player_id)
      values (m, gw, s, lg, pid);
    end loop;
  end loop;
end $$;

create function tc.mgr() returns uuid language sql as $$
  select id from public.ultima_managers where team_name = 'TeamC' $$;
create function tc.gw() returns uuid language sql as $$
  select id from public.ultima_gameweeks where number = 1
    and competition_id = (select competition_id from public.ultima_managers where team_name = 'TeamC') $$;
create function tc.pl(n text) returns uuid language sql as $$
  select id from public.ultima_players where name = n $$;
create function tc.caps(lg text) returns int language sql as $$
  select count(*)::int from public.ultima_lineups where manager_id = tc.mgr() and gameweek_id = tc.gw()
    and slot_group = lg and is_captain $$;
create function tc.set(n text) returns jsonb language sql as $$
  select public.ultima_set_captain(tc.mgr(), tc.gw(), tc.pl(n)) $$;

-- 1. Set a captain, then replace him in one call: still exactly one in the country.
begin;
select tc.setup();
select tc.assert((tc.set('pl-1')->>'ok')::boolean, 'first captain set');
select tc.assert(tc.caps('pl') = 1, 'one captain in pl');
select tc.assert((tc.set('pl-2')->>'ok')::boolean, 'replace ok');
select tc.assert(tc.caps('pl') = 1, 'still one captain in pl after replace');
select tc.assert(tc.set('pl-2')->>'previous_player_id' is null, 'no previous when re-picking the same player');
select tc.assert((select is_captain from public.ultima_lineups where player_id = tc.pl('pl-2')), 'new captain is pl-2');
select tc.assert(not (select is_captain from public.ultima_lineups where player_id = tc.pl('pl-1')), 'old captain cleared');
rollback;

-- 2. Five countries can each have a captain.
begin;
select tc.setup();
select tc.set(lg || '-1') from unnest(array['pl','laliga','seriea','bundesliga','ligue1']) lg;
select tc.assert((select count(*) from public.ultima_lineups where is_captain) = 5, 'five captains');
rollback;

-- 3. The database refuses two captains in one country.
begin;
select tc.setup();
select tc.set('pl-1');
do $$ begin
  update public.ultima_lineups set is_captain = true where player_id = tc.pl('pl-2');
  raise exception 'FAIL: second captain was allowed';
exception when unique_violation then null; end $$;
rollback;

-- 4. A locked country refuses a captain change; other countries still work.
begin;
select tc.setup(now() - interval '1 hour');
select tc.assert(tc.set('pl-1')->>'code' = 'CAPTAIN_LOCKED', 'pl locked past open time');
select tc.assert(tc.caps('pl') = 0, 'nothing written for locked pl');
select tc.assert((tc.set('laliga-1')->>'ok')::boolean, 'laliga still open');
rollback;

-- 5. A live gameweek with no open times locks every country.
begin;
select tc.setup(now(), 'live', false);
select tc.assert(tc.set('pl-1')->>'code' = 'CAPTAIN_LOCKED', 'live with no open time is locked');
rollback;

-- 6. A player outside the XV cannot be captain.
begin;
select tc.setup();
update public.ultima_lineups set player_id = null where player_id = tc.pl('pl-3');
select tc.assert(tc.set('pl-3')->>'code' = 'NOT_IN_XV', 'benched player cannot captain');
rollback;

-- 7. The captain leaves the XV (benched, traded or dropped): the flag clears.
begin;
select tc.setup();
select tc.set('pl-1');
update public.ultima_lineups set player_id = null where player_id = tc.pl('pl-1');
select tc.assert(tc.caps('pl') = 0, 'captain cleared when benched');
select tc.set('pl-2');
update public.ultima_lineups set player_id = tc.pl('pl-1') where player_id = tc.pl('pl-2');
select tc.assert(tc.caps('pl') = 0, 'captain cleared when the slot player changes');
rollback;

-- 8. The existing clear-slot function (drop, trade) clears the captain too.
begin;
select tc.setup();
select tc.set('laliga-2');
select public.ultima_clear_lineup_slots(tc.mgr(), array[tc.pl('laliga-2')]);
select tc.assert(tc.caps('laliga') = 0, 'clear_lineup_slots clears the captain');
rollback;

-- 9. A captain flag cannot sit on an empty slot.
begin;
select tc.setup();
do $$ begin
  update public.ultima_lineups set player_id = null, is_captain = true where player_id = tc.pl('pl-1');
  -- the guard clears the flag when the slot empties, so the row ends clean
  perform tc.assert(not (select bool_or(is_captain and player_id is null) from public.ultima_lineups), 'no captain on an empty slot');
end $$;
rollback;

-- 10. A gameweek with no lineup rows: NOT_IN_XV, no crash.
begin;
select tc.setup();
delete from public.ultima_lineups;
select tc.assert(tc.set('pl-1')->>'code' = 'NOT_IN_XV', 'empty gameweek');
rollback;

select 'captains: all passed' as result;
