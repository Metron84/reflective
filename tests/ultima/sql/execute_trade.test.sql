-- Tests for ultima_execute_trade and ultima_clear_lineup_slots (migration 0044).
-- Each scenario runs in its own transaction and is rolled back.

create schema tt;
create temp table tt_comp (id uuid);

create function tt.assert(c boolean, m text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FAIL: %', m; end if;
end $$;

-- Competition, 4 humans, M1 and M2 with 4 players in each of the 5 leagues,
-- and gameweek 5 live with no league open yet.
create function tt.setup() returns void language plpgsql as $$
declare comp uuid; m uuid; pid uuid; lg text; i int; own text;
begin
  insert into public.ultima_competition (season_label) values ('test') returning id into comp;
  delete from tt_comp; insert into tt_comp values (comp);
  for i in 1..4 loop
    insert into public.ultima_managers (competition_id, team_name, manager_name, colour)
    values (comp, 'Team' || i, 'Mgr' || i, 'slate') returning id into m;
  end loop;
  foreach own in array array['M1','M2'] loop
    select id into m from public.ultima_managers
      where competition_id = comp and team_name = 'Team' || right(own, 1);
    foreach lg in array array['pl','laliga','seriea','bundesliga','ligue1'] loop
      for i in 1..4 loop
        insert into public.ultima_players (provider_id, name, league, club)
        values (own || lg || i, own || '-' || lg || '-' || i, lg, 'C') returning id into pid;
        insert into public.ultima_rosters (manager_id, player_id) values (m, pid);
      end loop;
    end loop;
  end loop;
  insert into public.ultima_gameweeks (competition_id, number, window_start, window_end, state)
  values (comp, 5, now() - interval '1 day', now() + interval '5 days', 'live');
end $$;

create function tt.mgr(n int) returns uuid language sql as $$
  select id from public.ultima_managers
  where competition_id = (select id from tt_comp) and team_name = 'Team' || n $$;

create function tt.pl(n text) returns uuid language sql as $$
  select id from public.ultima_players where name = n $$;

create function tt.owner(n text) returns uuid language sql as $$
  select manager_id from public.ultima_rosters where player_id = tt.pl(n) $$;

-- give: names from the proposer, get: names from the receiver.
create function tt.trade(prop int, rec int, st text, give text[], get text[],
                         expires timestamptz default now() - interval '1 minute')
returns uuid language plpgsql as $$
declare tid uuid; n text;
begin
  insert into public.ultima_trades (competition_id, proposer_id, receiver_id, state, review_expires_at)
  values ((select id from tt_comp), tt.mgr(prop), tt.mgr(rec), st, expires) returning id into tid;
  foreach n in array give loop
    insert into public.ultima_trade_players values (tid, tt.pl(n), tt.mgr(prop), tt.mgr(rec));
  end loop;
  foreach n in array get loop
    insert into public.ultima_trade_players values (tid, tt.pl(n), tt.mgr(rec), tt.mgr(prop));
  end loop;
  return tid;
end $$;

create function tt.state(tid uuid) returns text language sql as $$
  select state from public.ultima_trades where id = tid $$;

create function tt.event_count(ev text) returns int language sql as $$
  select count(*)::int from public.ultima_events where event = ev $$;

-- 1. Happy swap executes, squads move, the XV slot is left Empty.
begin;
select tt.setup();
do $$ declare tid uuid; r jsonb; gw uuid;
begin
  select id into gw from public.ultima_gameweeks;
  insert into public.ultima_lineups (manager_id, gameweek_id, slot, slot_group, player_id)
  values (tt.mgr(1), gw, 1, 'pl', tt.pl('M1-pl-1'));
  tid := tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']);
  r := public.ultima_execute_trade(tid);
  perform tt.assert(r ->> 'state' = 'executed', 'executed: ' || r::text);
  perform tt.assert(tt.owner('M1-pl-1') = tt.mgr(2), 'M1-pl-1 moved to M2');
  perform tt.assert(tt.owner('M2-pl-1') = tt.mgr(1), 'M2-pl-1 moved to M1');
  perform tt.assert((select player_id from public.ultima_lineups where manager_id = tt.mgr(1) and slot = 1) is null,
                    'slot left Empty');
  perform tt.assert(exists (select 1 from public.ultima_lineups where manager_id = tt.mgr(1) and slot = 1),
                    'slot row kept');
  perform tt.assert(tt.event_count('trade_executed') = 1, 'executed event');
  r := public.ultima_execute_trade(tid);
  perform tt.assert(r ->> 'code' = 'NOT_PENDING', 'second run is a no-op');
end $$;
rollback;

-- 2. Review still running: nothing happens.
begin;
select tt.setup();
do $$ declare tid uuid; r jsonb;
begin
  tid := tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1'], now() + interval '2 hours');
  r := public.ultima_execute_trade(tid);
  perform tt.assert(r ->> 'code' = 'NOT_READY', 'not ready');
  perform tt.assert(tt.state(tid) = 'review' and tt.owner('M1-pl-1') = tt.mgr(1), 'untouched');
end $$;
rollback;

-- 3. Two pending trades for one player: the other auto-voids, no one-sided swap.
begin;
select tt.setup();
do $$ declare a uuid; b uuid; c uuid; r jsonb;
begin
  a := tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']);
  b := tt.trade(1, 2, 'proposed', array['M1-pl-1'], array['M2-pl-2'], null);
  c := tt.trade(2, 1, 'awaiting_unlock', array['M2-pl-1'], array['M1-pl-3'], null);
  r := public.ultima_execute_trade(a);
  perform tt.assert(r ->> 'state' = 'executed', 'a executed');
  perform tt.assert(tt.state(b) = 'void', 'b void');
  perform tt.assert(tt.state(c) = 'void', 'c void');
  perform tt.assert((select void_reason from public.ultima_trades where id = b) = 'player_traded', 'reason');
  perform tt.assert(tt.event_count('trade_void') = 2, 'void events posted');
  perform tt.assert(tt.owner('M2-pl-2') = tt.mgr(2) and tt.owner('M1-pl-3') = tt.mgr(1), 'no one-sided swap');
  -- Running a voided trade does nothing.
  perform tt.assert(public.ultima_execute_trade(b) ->> 'code' = 'NOT_PENDING', 'void is final');
end $$;
rollback;

-- 4a. A trade that crosses a lock is held until next Friday 00:00 Gulf time.
begin;
select tt.setup();
do $$ declare tid uuid; r jsonb; gw uuid; pl_trade uuid;
begin
  update public.ultima_gameweeks
  set league_open_at = jsonb_build_object('bundesliga', now() - interval '1 hour'),
      window_end = timestamptz '2999-01-07 23:59:00+04';
  select id into gw from public.ultima_gameweeks;
  insert into public.ultima_lineups (manager_id, gameweek_id, slot, slot_group, player_id)
  values (tt.mgr(1), gw, 1, 'bundesliga', tt.pl('M1-bundesliga-1'));

  tid := tt.trade(1, 2, 'review', array['M1-bundesliga-1'], array['M2-bundesliga-1']);
  r := public.ultima_execute_trade(tid);
  perform tt.assert(r ->> 'state' = 'awaiting_unlock', 'held: ' || r::text);
  perform tt.assert((r ->> 'unlock_at')::timestamptz = timestamptz '2999-01-08 00:00:00+04', 'unlock Fri 00:00 GST');
  perform tt.assert(r -> 'leagues' = '["bundesliga"]'::jsonb, 'names the locked league');
  perform tt.assert(tt.owner('M1-bundesliga-1') = tt.mgr(1), 'squads untouched while held');
  perform tt.assert((select player_id from public.ultima_lineups where manager_id = tt.mgr(1) and slot = 1)
                    = tt.pl('M1-bundesliga-1'), 'old owner keeps the XV slot this week');
  perform tt.assert(tt.event_count('trade_awaiting_unlock') = 1, 'hold event');

  -- Still held on a second run before unlock.
  r := public.ultima_execute_trade(tid);
  perform tt.assert(r ->> 'code' = 'NOT_READY', 'held until unlock');

  -- A deal without a locked country is not held by someone else's lock.
  pl_trade := tt.trade(1, 2, 'review', array['M1-pl-2'], array['M2-pl-2']);
  r := public.ultima_execute_trade(pl_trade);
  perform tt.assert(r ->> 'state' = 'executed', 'PL deal executes while GER is locked');

  -- Unlock arrives: a new gameweek has started, nothing open yet.
  update public.ultima_trades set unlock_at = now() - interval '1 minute' where id = tid;
  update public.ultima_gameweeks set window_end = now() - interval '1 minute';
  insert into public.ultima_gameweeks (competition_id, number, window_start, window_end, state)
  values ((select id from tt_comp), 6, now() - interval '1 minute', now() + interval '6 days', 'upcoming');
  r := public.ultima_execute_trade(tid);
  perform tt.assert(r ->> 'state' = 'executed', 'executes after unlock: ' || r::text);
  perform tt.assert(tt.owner('M1-bundesliga-1') = tt.mgr(2), 'moved after unlock');
end $$;
rollback;

-- 4b. A window that ends exactly at midnight unlocks at that instant.
begin;
select tt.setup();
do $$ declare r jsonb;
begin
  update public.ultima_gameweeks
  set league_open_at = jsonb_build_object('pl', now() - interval '1 hour'),
      window_end = timestamptz '2999-01-08 00:00:00+04';
  r := public.ultima_execute_trade(tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']));
  perform tt.assert((r ->> 'unlock_at')::timestamptz = timestamptz '2999-01-08 00:00:00+04', 'midnight end');
end $$;
rollback;

-- 5. Floor: leaving 2 in a league voids the trade and changes no squad.
begin;
select tt.setup();
do $$ declare tid uuid; r jsonb;
begin
  tid := tt.trade(1, 2, 'review', array['M1-seriea-1','M1-seriea-2'], array['M2-pl-1','M2-pl-2']);
  r := public.ultima_execute_trade(tid);
  perform tt.assert(r ->> 'state' = 'void' and r ->> 'reason' = 'floor', 'floor void: ' || r::text);
  perform tt.assert(r #>> '{detail,league}' = 'seriea' and (r #>> '{detail,count}')::int = 2, 'names league and count');
  perform tt.assert(tt.owner('M1-seriea-1') = tt.mgr(1) and tt.owner('M2-pl-1') = tt.mgr(2), 'squads untouched');
end $$;
rollback;

-- 6. Squad size is capped.
begin;
select tt.setup();
do $$ declare r jsonb;
begin
  r := public.ultima_execute_trade(tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']), 4, 19);
  perform tt.assert(r ->> 'reason' = 'squad_size', 'size cap: ' || r::text);
end $$;
rollback;

-- 7. A player left the squad before execution.
begin;
select tt.setup();
do $$ declare tid uuid; r jsonb;
begin
  tid := tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']);
  delete from public.ultima_rosters where player_id = tt.pl('M1-pl-1');
  r := public.ultima_execute_trade(tid);
  perform tt.assert(r ->> 'reason' = 'ownership_changed', 'ownership: ' || r::text);
  perform tt.assert(tt.owner('M2-pl-1') = tt.mgr(2), 'other side untouched');
end $$;
rollback;

-- 8. Veto majority: other human managers only, bots never count.
begin;
select tt.setup();
do $$ declare tid uuid; r jsonb; bot uuid; persona text;
begin
  select id into persona from public.ultima_bot_personas limit 1;
  insert into public.ultima_managers (competition_id, is_bot, persona_id)
  values ((select id from tt_comp), true, persona) returning id into bot;

  -- Humans other than the parties: Team3 and Team4. Majority is 2.
  tid := tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']);
  insert into public.ultima_trade_votes (trade_id, manager_id) values (tid, tt.mgr(3)), (tid, bot);
  r := public.ultima_execute_trade(tid);
  perform tt.assert(r ->> 'state' = 'executed', 'one human veto plus a bot is not a majority: ' || r::text);
end $$;
rollback;

begin;
select tt.setup();
do $$ declare tid uuid; r jsonb;
begin
  tid := tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']);
  insert into public.ultima_trade_votes (trade_id, manager_id)
  values (tid, tt.mgr(3)), (tid, tt.mgr(4)), (tid, tt.mgr(2));
  r := public.ultima_execute_trade(tid);
  perform tt.assert(r ->> 'state' = 'vetoed', 'two of two others vetoes: ' || r::text);
  perform tt.assert(tt.owner('M1-pl-1') = tt.mgr(1), 'vetoed trade moves nothing');
  perform tt.assert(tt.event_count('trade_vetoed') = 1, 'veto event');
end $$;
rollback;

begin;
select tt.setup();
do $$ declare tid uuid; r jsonb;
begin
  -- A party's vote never counts, even if it exists.
  tid := tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']);
  insert into public.ultima_trade_votes (trade_id, manager_id)
  values (tid, tt.mgr(2)), (tid, tt.mgr(1));
  r := public.ultima_execute_trade(tid);
  perform tt.assert(r ->> 'state' = 'executed', 'party votes ignored: ' || r::text);
end $$;
rollback;

-- 9. Window and deadline.
begin;
select tt.setup();
do $$ declare r jsonb;
begin
  update public.ultima_gameweeks set number = 3;
  r := public.ultima_execute_trade(tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']));
  perform tt.assert(r ->> 'reason' = 'not_open', 'before GW4: ' || r::text);
end $$;
rollback;

begin;
select tt.setup();
do $$ declare r jsonb;
begin
  update public.ultima_competition set trade_deadline_gw = 4;
  update public.ultima_gameweeks set number = 9;
  r := public.ultima_execute_trade(tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']));
  perform tt.assert(r ->> 'state' = 'executed', 'default deadline means none: ' || r::text);
end $$;
rollback;

begin;
select tt.setup();
do $$ declare r jsonb;
begin
  update public.ultima_competition set trade_deadline_gw = 8;
  update public.ultima_gameweeks set number = 9;
  r := public.ultima_execute_trade(tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']));
  perform tt.assert(r ->> 'reason' = 'deadline_passed', 'past deadline: ' || r::text);
end $$;
rollback;

-- 10. All or nothing: a failure after the squads move rolls everything back.
begin;
select tt.setup();
create function tt.boom() returns trigger language plpgsql as $$
begin raise exception 'forced failure'; end $$;
do $$ declare tid uuid; gw uuid; failed boolean := false;
begin
  select id into gw from public.ultima_gameweeks;
  insert into public.ultima_lineups (manager_id, gameweek_id, slot, slot_group, player_id)
  values (tt.mgr(1), gw, 1, 'pl', tt.pl('M1-pl-1'));
  create trigger tt_boom before update on public.ultima_lineups
    for each row execute function tt.boom();
  tid := tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']);
  begin
    perform public.ultima_execute_trade(tid);
  exception when others then
    failed := sqlerrm like '%forced failure%';
  end;
  perform tt.assert(failed, 'the function raised');
  perform tt.assert(tt.owner('M1-pl-1') = tt.mgr(1) and tt.owner('M2-pl-1') = tt.mgr(2), 'squads rolled back');
  perform tt.assert(tt.state(tid) = 'review', 'state rolled back');
  perform tt.assert(tt.event_count('trade_executed') = 0, 'no event');
end $$;
rollback;

-- 11. Lineup clearing respects lock and scoring state.
begin;
select tt.setup();
do $$ declare live_gw uuid; done_gw uuid; n int;
begin
  select id into live_gw from public.ultima_gameweeks;
  insert into public.ultima_gameweeks (competition_id, number, window_start, window_end, state)
  values ((select id from tt_comp), 4, now() - interval '9 days', now() - interval '2 days', 'provisional')
  returning id into done_gw;
  update public.ultima_gameweeks set league_open_at = jsonb_build_object('laliga', now() - interval '1 hour')
  where id = live_gw;

  insert into public.ultima_lineups (manager_id, gameweek_id, slot, slot_group, player_id) values
    (tt.mgr(1), live_gw, 1, 'pl', tt.pl('M1-pl-1')),
    (tt.mgr(1), live_gw, 2, 'laliga', tt.pl('M1-laliga-1')),
    (tt.mgr(1), done_gw, 1, 'pl', tt.pl('M1-pl-1'));

  n := public.ultima_clear_lineup_slots(tt.mgr(1), array[tt.pl('M1-pl-1'), tt.pl('M1-laliga-1')]);
  perform tt.assert(n = 1, 'only the open-league row in the unscored gameweek clears: ' || n);
  perform tt.assert((select player_id from public.ultima_lineups where gameweek_id = live_gw and slot = 1) is null,
                    'PL slot emptied');
  perform tt.assert((select player_id from public.ultima_lineups where gameweek_id = live_gw and slot = 2) is not null,
                    'locked LaLiga slot kept');
  perform tt.assert((select player_id from public.ultima_lineups where gameweek_id = done_gw and slot = 1) is not null,
                    'scored gameweek kept');
end $$;
rollback;

select 'ALL SQL TESTS PASSED' as result;
