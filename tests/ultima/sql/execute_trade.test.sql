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
  -- Open times are set ahead of now so no league is locked unless a test says so.
  insert into public.ultima_gameweeks (competition_id, number, window_start, window_end, state, league_open_at)
  values (comp, 5, now() - interval '1 day', now() + interval '5 days', 'live',
          jsonb_build_object('pl', now() + interval '2 days', 'laliga', now() + interval '2 days',
                             'seriea', now() + interval '2 days', 'bundesliga', now() + interval '2 days',
                             'ligue1', now() + interval '2 days'));
end $$;

create function tt.opens(lg text, at timestamptz) returns jsonb language sql as $$
  select jsonb_object_agg(l, case when l = lg then at else now() + interval '2 days' end)
  from unnest(array['pl','laliga','seriea','bundesliga','ligue1']) l $$;

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
  set league_open_at = tt.opens('bundesliga', now() - interval '1 hour'),
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
  set league_open_at = tt.opens('pl', now() - interval '1 hour'),
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
  perform tt.assert((select trade_deadline_gw from public.ultima_competition) is null, 'new seasons start with no deadline');
  update public.ultima_gameweeks set number = 9;
  r := public.ultima_execute_trade(tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']));
  perform tt.assert(r ->> 'state' = 'executed', 'null deadline means none: ' || r::text);
end $$;
rollback;

begin;
select tt.setup();
do $$ declare r jsonb;
begin
  -- 4 is a real deadline now, not "none".
  update public.ultima_competition set trade_deadline_gw = 4;
  update public.ultima_gameweeks set number = 9;
  r := public.ultima_execute_trade(tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']));
  perform tt.assert(r ->> 'reason' = 'deadline_passed', 'deadline 4 is enforced: ' || r::text);
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
  update public.ultima_gameweeks set league_open_at = tt.opens('laliga', now() - interval '1 hour')
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


-- 9b. Judged where the review ended: a late settlement is not voided by the deadline.
begin;
select tt.setup();
do $$ declare r jsonb; tid uuid;
begin
  update public.ultima_competition set trade_deadline_gw = 8;
  -- GW8 ran from 3 days ago to 1 day ago. GW9 started 1 day ago.
  update public.ultima_gameweeks
  set number = 8, window_start = now() - interval '3 days', window_end = now() - interval '1 day';
  insert into public.ultima_gameweeks (competition_id, number, window_start, window_end, state, league_open_at)
  values ((select id from tt_comp), 9, now() - interval '1 day', now() + interval '6 days', 'live',
          tt.opens('none', now()));
  -- Review ended 2 days ago, inside GW8. Nothing settled it until now, inside GW9.
  tid := tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1'], now() - interval '2 days');
  r := public.ultima_execute_trade(tid);
  perform tt.assert(r ->> 'state' = 'executed', 'review ended before the deadline closed: ' || r::text);
end $$;
rollback;

-- 9c. Locks are judged on the gameweek running now, even for a late settlement.
begin;
select tt.setup();
do $$ declare r jsonb; tid uuid;
begin
  update public.ultima_gameweeks
  set number = 8, window_start = now() - interval '3 days', window_end = now() - interval '1 day';
  insert into public.ultima_gameweeks (competition_id, number, window_start, window_end, state, league_open_at)
  values ((select id from tt_comp), 9, now() - interval '1 day', timestamptz '2999-01-07 23:59:00+04', 'live',
          jsonb_build_object('pl', now() - interval '1 hour'));
  tid := tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1'], now() - interval '2 days');
  r := public.ultima_execute_trade(tid);
  perform tt.assert(r ->> 'state' = 'awaiting_unlock', 'PL is locked in GW9, so the trade holds: ' || r::text);
  perform tt.assert(tt.owner('M1-pl-1') = tt.mgr(1), 'squads untouched');
end $$;
rollback;

-- 12. Dropping a player voids the dropper's pending trades that include him.
begin;
select tt.setup();
do $$ declare a uuid; b uuid; c uuid; d uuid; e uuid; r jsonb;
begin
  a := tt.trade(1, 2, 'proposed', array['M1-pl-1'], array['M2-pl-1'], null);
  b := tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-2']);
  c := tt.trade(2, 1, 'proposed', array['M2-laliga-1'], array['M1-pl-1'], null);
  d := tt.trade(1, 2, 'executed', array['M1-pl-1'], array['M2-pl-3'], null);
  e := tt.trade(1, 2, 'proposed', array['M1-pl-2'], array['M2-pl-4'], null);

  r := public.ultima_void_trades_for_players(tt.mgr(1), array[tt.pl('M1-pl-1')], 'player_dropped');
  perform tt.assert(jsonb_array_length(r -> 'voided') = 3, 'a, b and c void: ' || r::text);
  perform tt.assert(tt.state(a) = 'void' and tt.state(b) = 'void', 'both pending trades void');
  perform tt.assert(tt.state(c) = 'void', 'it voids when he is the receiver side too, as long as M1 gives him');
  perform tt.assert((select void_reason from public.ultima_trades where id = a) = 'player_dropped', 'reason');
  perform tt.assert((r #>> '{voided,0,other_manager_id}')::uuid = tt.mgr(2), 'names the other manager');
  perform tt.assert(tt.state(d) = 'executed', 'executed trades are untouched');
  perform tt.assert(tt.state(e) = 'proposed', 'trades without him are untouched');
  perform tt.assert(tt.event_count('trade_void') = 3, 'one event per voided trade');
  perform tt.assert((select count(*) from public.ultima_events
                     where event = 'trade_void' and manager_id = tt.mgr(1)
                       and payload ->> 'reason' = 'player_dropped') = 3, 'events carry the reason');

  r := public.ultima_void_trades_for_players(tt.mgr(1), array[tt.pl('M1-pl-1')], 'player_dropped');
  perform tt.assert(jsonb_array_length(r -> 'voided') = 0, 'second call finds nothing');
end $$;
rollback;

-- 13. Admin undo path: the same two helpers, the undone pick's manager as the giver.
begin;
select tt.setup();
do $$ declare a uuid; gw uuid; r jsonb;
begin
  select id into gw from public.ultima_gameweeks;
  insert into public.ultima_lineups (manager_id, gameweek_id, slot, slot_group, player_id)
  values (tt.mgr(1), gw, 1, 'pl', tt.pl('M1-pl-1'));
  a := tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']);
  perform public.ultima_clear_lineup_slots(tt.mgr(1), array[tt.pl('M1-pl-1')]);
  r := public.ultima_void_trades_for_players(tt.mgr(1), array[tt.pl('M1-pl-1')], 'pick_undone');
  perform tt.assert(tt.state(a) = 'void' and (select void_reason from public.ultima_trades where id = a) = 'pick_undone',
                    'pick undo voids the trade');
  perform tt.assert((select player_id from public.ultima_lineups where manager_id = tt.mgr(1) and slot = 1) is null,
                    'pick undo empties the slot');
end $$;
rollback;


-- 14. Damage queries (read-only reports). Synthetic old-style damage.
\set q1 `cat ultima_damage_1_executed_trades.sql`
\set q2 `cat ultima_damage_2_lineups.sql`
\set q3 `cat ultima_damage_3_pending_trades.sql`

begin;
select tt.setup();
do $$ declare t_half uuid; t_ok uuid; t_gone uuid; t_later uuid; t_proposed uuid;
begin
  -- Fully moved: M1 gave pl-1 to M2, M2 gave pl-1 to M1. Nothing to report.
  t_ok := tt.trade(1, 2, 'executed', array['M1-pl-1'], array['M2-pl-1'], null);
  update public.ultima_rosters set manager_id = tt.mgr(2) where player_id = tt.pl('M1-pl-1');
  update public.ultima_rosters set manager_id = tt.mgr(1) where player_id = tt.pl('M2-pl-1');

  -- Half moved: M2's pl-2 reached M1, M1's pl-2 never left.
  t_half := tt.trade(1, 2, 'executed', array['M1-pl-2'], array['M2-pl-2'], null);
  update public.ultima_rosters set manager_id = tt.mgr(1) where player_id = tt.pl('M2-pl-2');

  -- Stranded: the giver's row was deleted and the insert failed.
  t_gone := tt.trade(1, 2, 'executed', array['M1-pl-3'], array['M2-pl-3'], null);
  update public.ultima_rosters set manager_id = tt.mgr(1) where player_id = tt.pl('M2-pl-3');
  delete from public.ultima_rosters where player_id = tt.pl('M1-pl-3');

  -- Landed, then the receiver dropped him: explained.
  t_later := tt.trade(1, 2, 'executed', array['M1-pl-4'], array['M2-pl-4'], null);
  update public.ultima_rosters set manager_id = tt.mgr(1) where player_id = tt.pl('M2-pl-4');
  update public.ultima_rosters set manager_id = tt.mgr(2) where player_id = tt.pl('M1-pl-4');
  delete from public.ultima_rosters where player_id = tt.pl('M1-pl-4');
  insert into public.ultima_transactions (manager_id, type, player_id)
  values (tt.mgr(2), 'drop', tt.pl('M1-pl-4'));
  update public.ultima_trades set resolved_at = now() - interval '2 days' where id = t_later;

  t_proposed := tt.trade(1, 2, 'proposed', array['M1-laliga-1'], array['M2-laliga-1'], null);

  create temp table tt_ids (k text, v uuid) on commit drop;
  insert into tt_ids values ('ok', t_ok), ('half', t_half), ('gone', t_gone), ('later', t_later);
end $$;

create temp table r1 on commit drop as :q1;

do $$ declare t_ok uuid; t_half uuid; t_gone uuid; t_later uuid;
begin
  select v into t_ok from tt_ids where k = 'ok';
  select v into t_half from tt_ids where k = 'half';
  select v into t_gone from tt_ids where k = 'gone';
  select v into t_later from tt_ids where k = 'later';
  perform tt.assert((select count(*) from r1) = 3, 'three damaged trades: ' || (select count(*) from r1));
  perform tt.assert(not exists (select 1 from r1 where trade_id = t_ok), 'clean trade not listed');
  perform tt.assert((select unexplained_players from r1 where trade_id = t_half) = 1, 'half move found');
  perform tt.assert((select did_not_land from r1 where trade_id = t_half) like 'M1-pl-2 (now: Team1)', 'names owner now');
  perform tt.assert((select did_not_land from r1 where trade_id = t_gone) like 'M1-pl-3 (now: nobody)', 'stranded player');
  perform tt.assert((select unexplained_players from r1 where trade_id = t_later) = 0, 'later drop explains it');
  perform tt.assert((select proposer_gave from r1 where trade_id = t_half) = 'M1-pl-2', 'who gave what');
  perform tt.assert((select receiver_gave from r1 where trade_id = t_half) = 'M2-pl-2', 'who received what');
  perform tt.assert((select proposer_team from r1 where trade_id = t_half) = 'Team1', 'team names');
end $$;
rollback;

begin;
select tt.setup();
do $$ declare gw uuid; done_gw uuid; rows int;
begin
  -- A final gameweek whose PL matchday opened 10 days ago.
  update public.ultima_gameweeks
  set state = 'final', number = 3,
      window_start = now() - interval '12 days', window_end = now() - interval '6 days',
      league_open_at = tt.opens('pl', now() - interval '10 days')
  returning id into done_gw;

  -- Drafted before kickoff, never moved: fine.
  insert into public.ultima_draft_picks (competition_id, manager_id, player_id, round, pick_number, picked_at)
  values ((select id from tt_comp), tt.mgr(1), tt.pl('M1-pl-1'), 1, 1, now() - interval '30 days');
  -- Drafted, then traded away 20 days ago, before kickoff, yet still in the XV: damage.
  insert into public.ultima_draft_picks (competition_id, manager_id, player_id, round, pick_number, picked_at)
  values ((select id from tt_comp), tt.mgr(1), tt.pl('M1-pl-2'), 1, 2, now() - interval '30 days');
  perform tt.trade(1, 2, 'executed', array['M1-pl-2'], array['M2-pl-2'], null);
  update public.ultima_trades set resolved_at = now() - interval '20 days';
  -- Traded away 8 days ago, after kickoff: legitimate.
  insert into public.ultima_draft_picks (competition_id, manager_id, player_id, round, pick_number, picked_at)
  values ((select id from tt_comp), tt.mgr(1), tt.pl('M1-pl-3'), 1, 3, now() - interval '30 days');
  perform tt.trade(1, 2, 'executed', array['M1-pl-3'], array['M2-pl-3'], null);
  update public.ultima_trades set resolved_at = now() - interval '8 days'
  where id in (select trade_id from public.ultima_trade_players where player_id = tt.pl('M1-pl-3'));
  -- No record at all of M1 owning him: damage.
  insert into public.ultima_lineups (manager_id, gameweek_id, slot, slot_group, player_id) values
    (tt.mgr(1), done_gw, 1, 'pl', tt.pl('M1-pl-1')),
    (tt.mgr(1), done_gw, 2, 'pl', tt.pl('M1-pl-2')),
    (tt.mgr(1), done_gw, 3, 'pl', tt.pl('M1-pl-3')),
    (tt.mgr(1), done_gw, 4, 'pl', tt.pl('M2-pl-4'));
end $$;

create temp table r2 on commit drop as :q2;

do $$
begin
  perform tt.assert((select count(*) from r2) = 2, 'two damaged rows: ' || (select count(*) from r2));
  perform tt.assert((select reason from r2 where player_name = 'M1-pl-2') = 'gone before kickoff', 'traded before kickoff');
  perform tt.assert((select reason from r2 where player_name = 'M2-pl-4') = 'never owned before kickoff', 'never owned');
  perform tt.assert(not exists (select 1 from r2 where player_name in ('M1-pl-1', 'M1-pl-3')), 'owned at kickoff is not listed');
  perform tt.assert((select manager_team from r2 where player_name = 'M1-pl-2') = 'Team1', 'manager named');
end $$;
rollback;

begin;
select tt.setup();
do $$ declare a uuid; b uuid; c uuid; d uuid;
begin
  a := tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1'], now() + interval '5 hours');
  b := tt.trade(1, 2, 'accepted', array['M1-pl-2'], array['M2-pl-2'], now() - interval '3 hours');
  c := tt.trade(1, 2, 'proposed', array['M1-pl-3'], array['M2-pl-3'], null);
  d := tt.trade(1, 2, 'executed', array['M1-pl-4'], array['M2-pl-4'], null);
  insert into public.ultima_trade_votes (trade_id, manager_id) values (a, tt.mgr(3)), (a, tt.mgr(4));
  create temp table tt_ids (k text, v uuid) on commit drop;
  insert into tt_ids values ('a', a), ('b', b);
end $$;

create temp table r3 on commit drop as :q3;

do $$ declare a uuid; b uuid;
begin
  select v into a from tt_ids where k = 'a';
  select v into b from tt_ids where k = 'b';
  perform tt.assert((select count(*) from r3) = 2, 'review and accepted only');
  perform tt.assert((select veto_votes from r3 where trade_id = a) = 2, 'veto votes counted');
  perform tt.assert((select hours_left from r3 where trade_id = a) between 4.9 and 5.1, 'hours left');
  perform tt.assert((select hours_left from r3 where trade_id = b) < 0, 'overdue shows negative');
  perform tt.assert((select proposer_gives from r3 where trade_id = a) = 'M1-pl-1', 'players listed');
end $$;
rollback;

-- 12. Auto-clear: a trade removes block rows and untouchable flags for the moved players.
begin;
select tt.setup();
do $$ declare tid uuid; r jsonb;
begin
  insert into public.ultima_trade_block (manager_id, player_id, stance)
  values (tt.mgr(1), tt.pl('M1-pl-1'), 'listed'), (tt.mgr(1), tt.pl('M1-pl-2'), 'open');
  insert into public.ultima_untouchables (manager_id, player_id)
  values (tt.mgr(1), tt.pl('M1-pl-1')), (tt.mgr(1), tt.pl('M1-pl-3'));
  tid := tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']);
  r := public.ultima_execute_trade(tid);
  perform tt.assert(r ->> 'state' = 'executed', 'executed: ' || r::text);
  perform tt.assert(not exists (select 1 from public.ultima_trade_block where player_id = tt.pl('M1-pl-1')),
                    'block row cleared for moved player');
  perform tt.assert(exists (select 1 from public.ultima_trade_block where player_id = tt.pl('M1-pl-2')),
                    'other block row kept');
  perform tt.assert(not exists (select 1 from public.ultima_untouchables where player_id = tt.pl('M1-pl-1')),
                    'untouchable cleared for moved player');
  perform tt.assert(exists (select 1 from public.ultima_untouchables where player_id = tt.pl('M1-pl-3')),
                    'other untouchable kept');
end $$;
rollback;

-- 13. Auto-clear on drop, and pending trades with the player void.
begin;
select tt.setup();
do $$ declare tid uuid; r jsonb;
begin
  insert into public.ultima_trade_block (manager_id, player_id, stance) values (tt.mgr(1), tt.pl('M1-pl-1'), 'listed');
  insert into public.ultima_untouchables (manager_id, player_id) values (tt.mgr(1), tt.pl('M1-pl-1'));
  tid := tt.trade(1, 2, 'proposed', array['M1-pl-1'], array['M2-pl-1'], null);
  r := public.ultima_void_trades_for_players(tt.mgr(1), array[tt.pl('M1-pl-1')]);
  perform tt.assert(tt.state(tid) = 'void', 'pending trade voided on drop');
  delete from public.ultima_rosters where player_id = tt.pl('M1-pl-1');
  perform tt.assert(not exists (select 1 from public.ultima_trade_block where player_id = tt.pl('M1-pl-1')),
                    'block row cleared on drop');
  perform tt.assert(not exists (select 1 from public.ultima_untouchables where player_id = tt.pl('M1-pl-1')),
                    'untouchable cleared on drop');
end $$;
rollback;

-- 14. At most 3 untouchables per manager.
begin;
select tt.setup();
do $$ declare caught boolean := false;
begin
  insert into public.ultima_untouchables (manager_id, player_id)
  values (tt.mgr(1), tt.pl('M1-pl-1')), (tt.mgr(1), tt.pl('M1-pl-2')), (tt.mgr(1), tt.pl('M1-pl-3'));
  begin
    insert into public.ultima_untouchables (manager_id, player_id) values (tt.mgr(1), tt.pl('M1-pl-4'));
  exception when others then caught := true;
  end;
  perform tt.assert(caught, 'fourth untouchable rejected');
end $$;
rollback;

-- 15. Clear-slot fix: no open time clears in an upcoming gameweek, never in a live one.
begin;
select tt.setup();
do $$ declare gw uuid; n int;
begin
  select id into gw from public.ultima_gameweeks;
  update public.ultima_gameweeks set league_open_at = '{}'::jsonb, state = 'live' where id = gw;
  insert into public.ultima_lineups (manager_id, gameweek_id, slot, slot_group, player_id)
  values (tt.mgr(1), gw, 1, 'pl', tt.pl('M1-pl-1'));
  n := public.ultima_clear_lineup_slots(tt.mgr(1), array[tt.pl('M1-pl-1')]);
  perform tt.assert(n = 0, 'live gameweek with no open time keeps the slot');
  update public.ultima_gameweeks set state = 'upcoming' where id = gw;
  n := public.ultima_clear_lineup_slots(tt.mgr(1), array[tt.pl('M1-pl-1')]);
  perform tt.assert(n = 1, 'upcoming gameweek with no open time clears the slot');
end $$;
rollback;

-- 16. A live gameweek with no open time holds the trade like a lock.
begin;
select tt.setup();
do $$ declare r jsonb;
begin
  update public.ultima_gameweeks set league_open_at = '{}'::jsonb;
  r := public.ultima_execute_trade(tt.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']));
  perform tt.assert(r ->> 'state' = 'awaiting_unlock', 'live with no open time holds: ' || r::text);
end $$;
rollback;

select 'ALL SQL TESTS PASSED' as result;
