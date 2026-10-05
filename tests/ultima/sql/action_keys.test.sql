-- Tests for migration 0056: action keys table and the signing refusal that names who and when.
-- Each scenario runs in its own transaction and is rolled back.

create schema ak;

create function ak.assert(c boolean, m text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FAIL: %', m; end if;
end $$;

create function ak.setup() returns void language plpgsql as $$
declare comp uuid;
begin
  insert into public.ultima_competition (season_label) values ('ak') returning id into comp;
  insert into public.ultima_managers (competition_id, team_name, manager_name, colour)
  values (comp, 'Alpha', 'Mgr1', 'slate'), (comp, 'Beta', 'Mgr2', 'slate');
  insert into public.ultima_players (provider_id, name, league, club) values ('AKFA', 'AK-Free-Agent', 'pl', 'C');
end $$;

create function ak.comp() returns uuid language sql as $$
  select id from public.ultima_competition where season_label = 'ak' $$;

create function ak.mgr(t text) returns uuid language sql as $$
  select id from public.ultima_managers where team_name = t and competition_id = (
    select id from public.ultima_competition where season_label = 'ak') $$;

create function ak.fa() returns uuid language sql as $$
  select id from public.ultima_players where provider_id = 'AKFA' $$;

-- 1. The keys table: RLS on, one row per manager and key, a repeat is a unique violation.
begin;
select ak.setup();
do $$
begin
  perform ak.assert((select relrowsecurity from pg_class where oid = 'public.ultima_action_keys'::regclass), 'RLS is on');
  insert into public.ultima_action_keys (key, manager_id, competition_id, route) values ('tap-0001-abcdef', ak.mgr('Alpha'), ak.comp(), 'player/action');
  begin
    insert into public.ultima_action_keys (key, manager_id, competition_id, route) values ('tap-0001-abcdef', ak.mgr('Alpha'), ak.comp(), 'player/action');
    raise exception 'FAIL: a repeated key was accepted';
  exception when unique_violation then null; end;
  -- The same key from another manager is a different tap.
  insert into public.ultima_action_keys (key, manager_id, competition_id, route) values ('tap-0001-abcdef', ak.mgr('Beta'), ak.comp(), 'player/action');
  perform ak.assert((select result is null from public.ultima_action_keys where manager_id = ak.mgr('Alpha')), 'result is null while running');
  update public.ultima_action_keys set status = 200, result = '{"ok":true}'::jsonb where manager_id = ak.mgr('Alpha');
  perform ak.assert((select result ->> 'ok' from public.ultima_action_keys where manager_id = ak.mgr('Alpha')) = 'true', 'result stored');
end $$;
rollback;

-- 2. A signed player is refused to the next manager, with who and when.
begin;
select ak.setup();
do $$ declare r jsonb;
begin
  r := public.ultima_sign_player(ak.mgr('Alpha'), ak.fa(), null, null, 30, 3);
  perform ak.assert((r ->> 'ok')::boolean, 'first signing lands: ' || r::text);
  r := public.ultima_sign_player(ak.mgr('Beta'), ak.fa(), null, null, 30, 3);
  perform ak.assert(r ->> 'code' = 'PICK_TAKEN', 'second signing refused: ' || r::text);
  perform ak.assert(r ->> 'taken_by' = 'Alpha', 'names who');
  perform ak.assert((r ->> 'taken_at')::timestamptz > now() - interval '1 minute', 'says when');
  perform ak.assert((select count(*) from public.ultima_rosters where manager_id = ak.mgr('Beta')) = 0, 'loser squad untouched');
  perform ak.assert((select count(*) from public.ultima_events where event = 'market_add') = 1, 'one market_add event, none for the refusal');
end $$;
rollback;

-- 3. The claim: scoped to the competition, pending vs done, stale takeover, route mismatch, pruning.
begin;
select ak.setup();
do $$ declare r jsonb; other uuid;
begin
  r := public.ultima_claim_action_key('claim-key-0001', ak.mgr('Alpha'), ak.comp(), 'lineup/save');
  perform ak.assert(r ->> 'state' = 'claimed', 'first claim: ' || r::text);
  perform ak.assert((select competition_id from public.ultima_action_keys where key = 'claim-key-0001') = ak.comp(), 'competition_id stored');
  r := public.ultima_claim_action_key('claim-key-0001', ak.mgr('Alpha'), ak.comp(), 'lineup/save');
  perform ak.assert(r ->> 'state' = 'pending', 'repeat while running is pending');
  r := public.ultima_claim_action_key('claim-key-0001', ak.mgr('Alpha'), ak.comp(), 'lineup/captain');
  perform ak.assert(r ->> 'state' = 'route_mismatch', 'other route refused');
  update public.ultima_action_keys set created_at = now() - interval '2 minutes' where key = 'claim-key-0001';
  r := public.ultima_claim_action_key('claim-key-0001', ak.mgr('Alpha'), ak.comp(), 'lineup/save');
  perform ak.assert(r ->> 'state' = 'claimed' and (r ->> 'reclaimed')::boolean, 'stale claim is taken over: ' || r::text);
  update public.ultima_action_keys set status = 200, result = '{"ok":true}'::jsonb where key = 'claim-key-0001';
  r := public.ultima_claim_action_key('claim-key-0001', ak.mgr('Alpha'), ak.comp(), 'lineup/save');
  perform ak.assert(r ->> 'state' = 'done' and r -> 'result' ->> 'ok' = 'true', 'finished key replays');
  insert into public.ultima_competition (season_label, is_active) values ('ak2', false) returning id into other;
  r := public.ultima_claim_action_key('claim-key-0002', ak.mgr('Alpha'), other, 'lineup/save');
  perform ak.assert(r ->> 'state' = 'invalid', 'manager outside the competition is refused');
  perform ak.assert(not exists (select 1 from public.ultima_action_keys where key = 'claim-key-0002'), 'no row for a refused claim');
  update public.ultima_action_keys set created_at = now() - interval '8 days' where key = 'claim-key-0001';
  perform public.ultima_claim_action_key('claim-key-0003', ak.mgr('Alpha'), ak.comp(), 'lineup/save');
  perform ak.assert(not exists (select 1 from public.ultima_action_keys where key = 'claim-key-0001'), 'keys older than 7 days are pruned');
end $$;
rollback;

-- 4. A player on a practice roster can still be signed in the season competition.
begin;
select ak.setup();
do $$ declare practice uuid; pm uuid; r jsonb;
begin
  insert into public.ultima_competition (season_label, kind, is_active) values ('ak-practice', 'practice', false) returning id into practice;
  insert into public.ultima_managers (competition_id, team_name, manager_name, colour)
  values (practice, 'Practice', 'Mgr3', 'slate') returning id into pm;
  insert into public.ultima_rosters (manager_id, player_id, competition_id) values (pm, ak.fa(), practice);
  r := public.ultima_sign_player(ak.mgr('Alpha'), ak.fa(), null, null, 30, 3);
  perform ak.assert((r ->> 'ok')::boolean, 'signing is not blocked by a practice roster: ' || r::text);
  perform ak.assert((select competition_id from public.ultima_rosters where manager_id = ak.mgr('Alpha') and player_id = ak.fa()) = ak.comp(), 'roster row carries the season competition');
  perform ak.assert((select count(*) from public.ultima_rosters where player_id = ak.fa()) = 2, 'both rosters hold him');
  -- A second season manager is still refused, and the practice owner is not named.
  r := public.ultima_sign_player(ak.mgr('Beta'), ak.fa(), null, null, 30, 3);
  perform ak.assert(r ->> 'code' = 'PICK_TAKEN' and r ->> 'taken_by' = 'Alpha', 'season race still names the season owner: ' || r::text);
end $$;
rollback;

select 'action keys tests passed' as result;
