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
  insert into public.ultima_action_keys (key, manager_id, route) values ('tap-0001-abcdef', ak.mgr('Alpha'), 'player/action');
  begin
    insert into public.ultima_action_keys (key, manager_id, route) values ('tap-0001-abcdef', ak.mgr('Alpha'), 'player/action');
    raise exception 'FAIL: a repeated key was accepted';
  exception when unique_violation then null; end;
  -- The same key from another manager is a different tap.
  insert into public.ultima_action_keys (key, manager_id, route) values ('tap-0001-abcdef', ak.mgr('Beta'), 'player/action');
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

select 'action keys tests passed' as result;
