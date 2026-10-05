-- Tests for migration 0053: atomic accept, expiry, signing, live-offer guards.
-- Each scenario runs in its own transaction and is rolled back.

create schema pc;
create temp table pc_comp (id uuid);

create function pc.assert(c boolean, m text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FAIL: %', m; end if;
end $$;

-- Competition, 4 humans and a bot. M1 and M2 hold 4 players in each of the 5
-- leagues (20 each, so p_squad_size = 20 makes them full). Four free agents.
-- Gameweek 5 is live and no league has opened.
create function pc.setup() returns void language plpgsql as $$
declare comp uuid; m uuid; pid uuid; lg text; i int; own text;
begin
  insert into public.ultima_competition (season_label) values ('pc') returning id into comp;
  delete from pc_comp; insert into pc_comp values (comp);
  insert into public.ultima_bot_personas (id, name, risk, horizon, discipline, wobble) values ('pcbot', 'Bot', 0.5, 0.5, 0.5, 0.5)
  on conflict do nothing;
  for i in 1..4 loop
    insert into public.ultima_managers (competition_id, team_name, manager_name, colour)
    values (comp, 'Team' || i, 'Mgr' || i, 'slate');
  end loop;
  insert into public.ultima_managers (competition_id, team_name, manager_name, colour, is_bot, persona_id)
  values (comp, 'Botters', 'Bot', 'slate', true, 'pcbot');
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
  foreach lg in array array['pl','laliga'] loop
    for i in 1..2 loop
      insert into public.ultima_players (provider_id, name, league, club)
      values ('FA' || lg || i, 'FA-' || lg || '-' || i, lg, 'C');
    end loop;
  end loop;
  insert into public.ultima_gameweeks (competition_id, number, window_start, window_end, state, league_open_at)
  values (comp, 5, now() - interval '1 day', now() + interval '5 days', 'live',
          jsonb_build_object('pl', now() + interval '2 days', 'laliga', now() + interval '2 days',
                             'seriea', now() + interval '2 days', 'bundesliga', now() + interval '2 days',
                             'ligue1', now() + interval '2 days'));
end $$;

create function pc.mgr(n int) returns uuid language sql as $$
  select id from public.ultima_managers
  where competition_id = (select id from pc_comp) and team_name = 'Team' || n $$;

create function pc.bot() returns uuid language sql as $$
  select id from public.ultima_managers
  where competition_id = (select id from pc_comp) and is_bot $$;

create function pc.pl(n text) returns uuid language sql as $$
  select id from public.ultima_players where name = n $$;

create function pc.owner(n text) returns uuid language sql as $$
  select manager_id from public.ultima_rosters where player_id = pc.pl(n) $$;

create function pc.trade(prop int, rec int, st text, give text[], get text[],
                         age interval default interval '0')
returns uuid language plpgsql as $$
declare tid uuid; n text;
begin
  insert into public.ultima_trades (competition_id, proposer_id, receiver_id, state, review_expires_at, created_at)
  values ((select id from pc_comp), pc.mgr(prop), pc.mgr(rec), st,
          case when st = 'review' then now() + interval '2 hours' end, now() - age)
  returning id into tid;
  foreach n in array give loop
    insert into public.ultima_trade_players values (tid, pc.pl(n), pc.mgr(prop), pc.mgr(rec));
  end loop;
  foreach n in array get loop
    insert into public.ultima_trade_players values (tid, pc.pl(n), pc.mgr(rec), pc.mgr(prop));
  end loop;
  return tid;
end $$;

create function pc.state(tid uuid) returns text language sql as $$
  select state from public.ultima_trades where id = tid $$;

create function pc.reason(tid uuid) returns text language sql as $$
  select void_reason from public.ultima_trades where id = tid $$;

create function pc.events(ev text) returns int language sql as $$
  select count(*)::int from public.ultima_events where event = ev $$;

create function pc.sign(m int, add_n text, drop_n text default null) returns jsonb language sql as $$
  select public.ultima_sign_player(pc.mgr(m), pc.pl(add_n), case when drop_n is null then null else pc.pl(drop_n) end,
                                   (select id from public.ultima_gameweeks limit 1), 20, 3) $$;

-- 1. Accept: the offer goes to review, and every other live offer with a shared player is void.
begin;
select pc.setup();
do $$ declare a uuid; b uuid; c uuid; d uuid; r jsonb;
begin
  a := pc.trade(1, 2, 'proposed', array['M1-pl-1'], array['M2-pl-1']);
  -- b and c ask for the same player from other managers' view: they share M1-pl-1 or M2-pl-1.
  b := pc.trade(3, 2, 'proposed', array['M1-pl-4'], array['M2-pl-1']);
  c := pc.trade(4, 1, 'proposed', array[]::text[], array['M1-pl-1']);
  d := pc.trade(1, 3, 'proposed', array['M1-pl-2'], array[]::text[]);
  r := public.ultima_accept_trade(a, pc.mgr(2));
  perform pc.assert((r ->> 'ok')::boolean and r ->> 'state' = 'review', 'accepted: ' || r::text);
  perform pc.assert(pc.state(a) = 'review', 'a in review');
  perform pc.assert((select review_expires_at from public.ultima_trades where id = a) > now() + interval '23 hours', '24h review');
  perform pc.assert(pc.state(b) = 'void' and pc.reason(b) = 'player_in_accepted_deal', 'b void: ' || coalesce(pc.reason(b), 'null'));
  perform pc.assert(pc.state(c) = 'void' and pc.reason(c) = 'player_in_accepted_deal', 'c void');
  perform pc.assert(pc.state(d) = 'proposed', 'an offer with other players stays live');
  perform pc.assert(jsonb_array_length(r -> 'voided') = 2, 'two voided in the result');
  perform pc.assert(pc.events('trade_review') = 1 and pc.events('trade_void') = 2, 'events');
  r := public.ultima_accept_trade(a, pc.mgr(2));
  perform pc.assert(r ->> 'code' = 'NOT_OPEN', 'second accept is a no-op');
end $$;
rollback;

-- 2. Accept: only the receiver, only a proposed offer, never an expired one.
begin;
select pc.setup();
do $$ declare a uuid; b uuid; r jsonb;
begin
  a := pc.trade(1, 2, 'proposed', array['M1-pl-1'], array['M2-pl-1']);
  r := public.ultima_accept_trade(a, pc.mgr(1));
  perform pc.assert(r ->> 'code' = 'NOT_RECEIVER', 'proposer cannot accept');
  update public.ultima_trades set state = 'declined' where id = a;
  r := public.ultima_accept_trade(a, pc.mgr(2));
  perform pc.assert(r ->> 'code' = 'NOT_OPEN', 'declined is closed');
  b := pc.trade(1, 3, 'proposed', array['M1-pl-2'], array['M2-pl-2'], interval '49 hours');
  update public.ultima_trade_players set to_manager_id = pc.mgr(2) where trade_id = b;
  update public.ultima_trades set receiver_id = pc.mgr(2) where id = b;
  r := public.ultima_accept_trade(b, pc.mgr(2));
  perform pc.assert(r ->> 'code' = 'EXPIRED' and pc.state(b) = 'expired', 'late accept: ' || r::text);
  perform pc.assert(pc.events('trade_expired') = 1, 'expired event');
end $$;
rollback;

-- 3. Accept: a player already in an accepted deal stops it and voids the offer.
begin;
select pc.setup();
do $$ declare a uuid; b uuid; r jsonb;
begin
  a := pc.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']);
  b := pc.trade(1, 2, 'proposed', array['M1-pl-1'], array['M2-pl-2']);
  r := public.ultima_accept_trade(b, pc.mgr(2));
  perform pc.assert(r ->> 'code' = 'PLAYER_FROZEN', 'frozen: ' || r::text);
  perform pc.assert(r ->> 'player_name' = 'M1-pl-1', 'names the player');
  perform pc.assert(pc.state(b) = 'void' and pc.reason(b) = 'player_in_accepted_deal', 'void');
end $$;
rollback;

-- 4. Accept: a player who left the squad voids the offer.
begin;
select pc.setup();
do $$ declare a uuid; r jsonb;
begin
  a := pc.trade(1, 2, 'proposed', array['M1-pl-1'], array['M2-pl-1']);
  update public.ultima_rosters set manager_id = pc.mgr(3) where player_id = pc.pl('M1-pl-1');
  r := public.ultima_accept_trade(a, pc.mgr(2));
  perform pc.assert(r ->> 'code' = 'OWNERSHIP' and pc.state(a) = 'void', 'ownership: ' || r::text);
end $$;
rollback;

-- 5. Expiry: 48 hours, live offers only.
begin;
select pc.setup();
do $$ declare old_ uuid; fresh uuid; rev uuid; r jsonb;
begin
  old_ := pc.trade(1, 2, 'proposed', array['M1-pl-1'], array['M2-pl-1'], interval '49 hours');
  fresh := pc.trade(1, 3, 'proposed', array['M1-pl-2'], array['M2-pl-2'], interval '47 hours');
  rev := pc.trade(2, 3, 'review', array['M2-pl-3'], array['M1-pl-3'], interval '100 hours');
  r := public.ultima_expire_trades(48);
  perform pc.assert(jsonb_array_length(r -> 'expired') = 1, 'one expired: ' || r::text);
  perform pc.assert(pc.state(old_) = 'expired', 'old expired');
  perform pc.assert(pc.state(fresh) = 'proposed', 'a 47 hour offer lives');
  perform pc.assert(pc.state(rev) = 'review', 'an accepted deal never expires');
  perform pc.assert(pc.events('trade_expired') = 1, 'event');
  r := public.ultima_expire_trades(48);
  perform pc.assert(jsonb_array_length(r -> 'expired') = 0, 'idempotent');
end $$;
rollback;

-- 6. Cap: the 4th live offer is refused. A withdrawn offer frees a slot.
begin;
select pc.setup();
do $$ declare a uuid; failed boolean := false;
begin
  perform pc.trade(1, 2, 'proposed', array['M1-pl-1'], array['M2-pl-1']);
  perform pc.trade(1, 3, 'proposed', array['M1-pl-2'], array[]::text[]);
  a := pc.trade(1, 4, 'proposed', array['M1-pl-3'], array[]::text[]);
  begin
    perform pc.trade(1, 2, 'proposed', array['M1-laliga-1'], array['M2-laliga-1']);
  exception when others then
    failed := sqlerrm = 'trade_live_cap' or sqlstate = '23505';
  end;
  perform pc.assert(failed, '4th live offer refused');
  update public.ultima_trades set state = 'cancelled' where id = a;
  insert into public.ultima_trades (competition_id, proposer_id, receiver_id, state)
  values ((select id from pc_comp), pc.mgr(1), pc.bot(), 'proposed');
  perform pc.assert((select count(*) from public.ultima_trades where proposer_id = pc.mgr(1) and state = 'proposed') = 3, 'a withdrawal frees a slot');
end $$;
rollback;

begin;
select pc.setup();
do $$ declare failed boolean := false; msg text;
begin
  perform pc.trade(1, 2, 'proposed', array['M1-pl-1'], array['M2-pl-1']);
  perform pc.trade(1, 3, 'proposed', array['M1-pl-2'], array[]::text[]);
  perform pc.trade(1, 4, 'proposed', array['M1-pl-3'], array[]::text[]);
  begin
    insert into public.ultima_trades (competition_id, proposer_id, receiver_id, state)
    values ((select id from pc_comp), pc.mgr(1), pc.bot(), 'proposed');
  exception when others then
    failed := true; msg := sqlerrm;
  end;
  perform pc.assert(failed and msg = 'trade_live_cap', 'cap message: ' || coalesce(msg, 'none'));
  -- Other managers keep their own 3.
  perform pc.trade(2, 3, 'proposed', array['M2-pl-2'], array[]::text[]);
end $$;
rollback;

-- 7. One live offer per pair, in either direction. A counter replaces the original.
begin;
select pc.setup();
do $$ declare a uuid; failed boolean := false;
begin
  a := pc.trade(1, 2, 'proposed', array['M1-pl-1'], array['M2-pl-1']);
  begin
    perform pc.trade(2, 1, 'proposed', array['M2-pl-2'], array['M1-pl-2']);
  exception when unique_violation then
    failed := true;
  end;
  perform pc.assert(failed, 'reverse direction refused');
  update public.ultima_trades set state = 'countered' where id = a;
  perform pc.trade(2, 1, 'proposed', array['M2-pl-2'], array['M1-pl-2']);
  perform pc.assert((select count(*) from public.ultima_trades where state = 'proposed') = 1, 'one live offer after the counter');
  -- An accepted deal between the pair does not block a new live offer.
  perform pc.trade(1, 2, 'review', array['M1-pl-3'], array['M2-pl-3']);
end $$;
rollback;

-- 8. Sign: add a free agent, release a same-country player. Slot empties, captaincy
--    clears, live offers with him void, both events post, he returns to the market.
begin;
select pc.setup();
do $$ declare gw uuid; a uuid; b uuid; r jsonb;
begin
  select id into gw from public.ultima_gameweeks;
  insert into public.ultima_lineups (manager_id, gameweek_id, slot, slot_group, player_id, is_captain)
  values (pc.mgr(1), gw, 1, 'pl', pc.pl('M1-pl-1'), true);
  insert into public.ultima_trade_block (manager_id, player_id, stance) values (pc.mgr(1), pc.pl('M1-pl-1'), 'listed');
  a := pc.trade(1, 2, 'proposed', array['M1-pl-1'], array['M2-pl-1']);
  b := pc.trade(1, 3, 'proposed', array['M1-pl-2'], array[]::text[]);
  r := pc.sign(1, 'FA-pl-1', 'M1-pl-1');
  perform pc.assert((r ->> 'ok')::boolean, 'signed: ' || r::text);
  perform pc.assert(pc.owner('FA-pl-1') = pc.mgr(1), 'FA joined');
  perform pc.assert((select count(*) from public.ultima_rosters where manager_id = pc.mgr(1)) = 20, 'squad still full');
  perform pc.assert(not exists (select 1 from public.ultima_rosters where player_id = pc.pl('M1-pl-1')), 'released player is a free agent at once');
  perform pc.assert((select player_id from public.ultima_lineups where manager_id = pc.mgr(1) and slot = 1) is null, 'slot emptied');
  perform pc.assert(not (select is_captain from public.ultima_lineups where manager_id = pc.mgr(1) and slot = 1), 'captaincy cleared');
  perform pc.assert(pc.state(a) = 'void' and pc.reason(a) = 'player_released', 'live offer with him void');
  perform pc.assert(pc.state(b) = 'proposed', 'other offers live');
  perform pc.assert(not exists (select 1 from public.ultima_trade_block where player_id = pc.pl('M1-pl-1')), 'transfer listing cleared');
  perform pc.assert(pc.events('market_add') = 1 and pc.events('market_release') = 1, 'both events');
  perform pc.assert((select bolt_eligible from public.ultima_players where id = pc.pl('FA-pl-1')), 'undrafted FA is Bolt eligible');
  perform pc.assert((select count(*) from public.ultima_transactions where manager_id = pc.mgr(1)) = 2, 'transactions');
  -- A different manager can sign the released player straight away.
  update public.ultima_players set draft_round = 3, bolt_eligible = false where id = pc.pl('M1-pl-1');
  r := pc.sign(2, 'M1-pl-1', 'M2-pl-1');
  perform pc.assert((select draft_round from public.ultima_players where id = pc.pl('M1-pl-1')) = 3
    and not (select bolt_eligible from public.ultima_players where id = pc.pl('M1-pl-1')), 're-signed drafted player keeps draft_round, not Bolt eligible');
  perform pc.assert((r ->> 'ok')::boolean and pc.owner('M1-pl-1') = pc.mgr(2), 'first come first served');
end $$;
rollback;

-- 9. Sign: someone else has him.
begin;
select pc.setup();
do $$ declare r jsonb;
begin
  r := pc.sign(1, 'FA-pl-1', 'M1-pl-1');
  perform pc.assert((r ->> 'ok')::boolean, 'first sign');
  r := pc.sign(2, 'FA-pl-1', 'M2-pl-1');
  perform pc.assert(r ->> 'code' = 'PICK_TAKEN' and r ->> 'taken_by' = 'Team1', 'second sees the team: ' || r::text);
  perform pc.assert(pc.owner('M2-pl-1') = pc.mgr(2), 'second squad untouched');
  r := pc.sign(2, 'M1-pl-2', 'M2-pl-1');
  perform pc.assert(r ->> 'code' = 'PICK_TAKEN', 'owned player is not signable');
end $$;
rollback;

-- 10. Sign: a player in an accepted trade cannot be released. A live offer does not stop it.
begin;
select pc.setup();
do $$ declare r jsonb;
begin
  perform pc.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']);
  r := pc.sign(1, 'FA-pl-1', 'M1-pl-1');
  perform pc.assert(r ->> 'code' = 'IN_ACCEPTED_TRADE', 'frozen by review: ' || r::text);
  perform pc.assert(pc.owner('M1-pl-1') = pc.mgr(1) and pc.owner('FA-pl-1') is null, 'nothing changed');
  perform pc.trade(1, 3, 'awaiting_unlock', array['M1-pl-2'], array[]::text[]);
  r := pc.sign(1, 'FA-pl-1', 'M1-pl-2');
  perform pc.assert(r ->> 'code' = 'IN_ACCEPTED_TRADE', 'frozen by hold');
  r := pc.sign(1, 'FA-pl-1', 'M1-pl-3');
  perform pc.assert((r ->> 'ok')::boolean, 'others release fine');
end $$;
rollback;

-- 11. Sign: a locked XV slot cannot be released, a locked bench player can, a captain stays captain.
begin;
select pc.setup();
do $$ declare gw uuid; r jsonb;
begin
  select id into gw from public.ultima_gameweeks;
  update public.ultima_gameweeks set league_open_at = jsonb_set(league_open_at, '{pl}', to_jsonb(now() - interval '1 hour'));
  insert into public.ultima_lineups (manager_id, gameweek_id, slot, slot_group, player_id, is_captain)
  values (pc.mgr(1), gw, 1, 'pl', pc.pl('M1-pl-1'), true);
  r := pc.sign(1, 'FA-pl-1', 'M1-pl-1');
  perform pc.assert(r ->> 'code' = 'XV_LOCKED', 'locked XV slot: ' || r::text);
  perform pc.assert((select is_captain and player_id = pc.pl('M1-pl-1') from public.ultima_lineups where manager_id = pc.mgr(1) and slot = 1), 'captain untouched');
  perform pc.assert(pc.owner('M1-pl-1') = pc.mgr(1), 'still on the squad');
  r := pc.sign(1, 'FA-pl-1', 'M1-pl-2');
  perform pc.assert((r ->> 'ok')::boolean, 'bench player in a locked country goes: ' || r::text);
  perform pc.assert((select count(*) from public.ultima_lineups l where l.manager_id = pc.mgr(1) and l.player_id is not null) = 1, 'XV untouched');
end $$;
rollback;

-- 12. Sign: another country only if it stays at 3 or more. Same country always.
begin;
select pc.setup();
do $$ declare r jsonb;
begin
  -- M1 has 4 per league. Drop two laliga to leave exactly 2 elsewhere? First take laliga to 3.
  delete from public.ultima_rosters where player_id = pc.pl('M1-laliga-4');
  r := pc.sign(1, 'FA-pl-1', 'M1-laliga-1');
  perform pc.assert(r ->> 'code' = 'FLOOR_VIOLATION' and r ->> 'league' = 'laliga', 'laliga would fall to 2: ' || r::text);
  r := pc.sign(1, 'FA-laliga-1', 'M1-laliga-1');
  perform pc.assert((r ->> 'ok')::boolean, 'same country is fine: ' || r::text);
  r := pc.sign(1, 'FA-pl-1', 'M1-seriea-1');
  perform pc.assert((r ->> 'ok')::boolean, 'another country at 4 stays at 3: ' || r::text);
end $$;
rollback;

-- 13. Sign: a full squad needs a release. Not owned means refused.
begin;
select pc.setup();
do $$ declare r jsonb;
begin
  r := pc.sign(1, 'FA-pl-1');
  perform pc.assert(r ->> 'code' = 'SQUAD_FULL', 'full: ' || r::text);
  r := pc.sign(1, 'FA-pl-1', 'M2-pl-1');
  perform pc.assert(r ->> 'code' = 'NOT_OWNED', 'cannot release his player');
  perform pc.assert(pc.owner('FA-pl-1') is null, 'nothing signed');
end $$;
rollback;

-- 14. Signed after his country locks: he is on the bench, in no XV.
begin;
select pc.setup();
do $$ declare r jsonb;
begin
  update public.ultima_gameweeks set league_open_at = jsonb_set(league_open_at, '{laliga}', to_jsonb(now() - interval '1 hour'));
  r := pc.sign(1, 'FA-laliga-1', 'M1-laliga-1');
  perform pc.assert((r ->> 'ok')::boolean, 'signing is allowed after the lock: ' || r::text);
  perform pc.assert(not exists (select 1 from public.ultima_lineups where player_id = pc.pl('FA-laliga-1')), 'on the bench');
end $$;
rollback;

-- 15. A trade that executes: a captain loses the armband and the slot is empty.
begin;
select pc.setup();
do $$ declare gw uuid; tid uuid; r jsonb;
begin
  select id into gw from public.ultima_gameweeks;
  insert into public.ultima_lineups (manager_id, gameweek_id, slot, slot_group, player_id, is_captain)
  values (pc.mgr(1), gw, 1, 'pl', pc.pl('M1-pl-1'), true);
  tid := pc.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']);
  update public.ultima_trades set review_expires_at = now() - interval '1 minute' where id = tid;
  r := public.ultima_execute_trade(tid);
  perform pc.assert(r ->> 'state' = 'executed', 'executed: ' || r::text);
  perform pc.assert((select player_id is null and not is_captain from public.ultima_lineups where manager_id = pc.mgr(1) and slot = 1), 'slot empty, no captain');
end $$;
rollback;

-- 16. Locked country at the end of review: the trade holds for the Friday unlock.
begin;
select pc.setup();
do $$ declare tid uuid; r jsonb;
begin
  update public.ultima_gameweeks set league_open_at = jsonb_set(league_open_at, '{pl}', to_jsonb(now() - interval '1 hour'));
  tid := pc.trade(1, 2, 'review', array['M1-pl-1'], array['M2-pl-1']);
  update public.ultima_trades set review_expires_at = now() - interval '1 minute' where id = tid;
  r := public.ultima_execute_trade(tid);
  perform pc.assert(r ->> 'state' = 'awaiting_unlock', 'held: ' || r::text);
  perform pc.assert(pc.owner('M1-pl-1') = pc.mgr(1), 'nobody moved');
  perform pc.assert(((select unlock_at at time zone 'Asia/Dubai' from public.ultima_trades where id = tid))::time = time '00:00', 'unlocks at Dubai midnight');
end $$;
rollback;

select 'player card and trades: all passed' as result;
