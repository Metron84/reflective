-- Tests for migration 0055: a manager reads only their own notifications and
-- push subscriptions, and no manager can write any of the three tables.
-- Everything runs in transactions that are rolled back.

create schema tn;

create function tn.assert(c boolean, m text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FAIL: %', m; end if;
end $$;

-- The stub's auth.uid() returns null. Read the signed-in user from a setting instead.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('tn.uid', true), '')::uuid $$;

grant usage on schema tn, auth, public to authenticated;

create function tn.setup() returns void language plpgsql as $$
declare c1 uuid; c2 uuid; m1 uuid; m2 uuid; m3 uuid;
begin
  insert into auth.users (id) values
    ('11111111-1111-1111-1111-111111111111'),
    ('22222222-2222-2222-2222-222222222222'),
    ('33333333-3333-3333-3333-333333333333');
  insert into public.ultima_competition (season_label, is_active) values ('a', true) returning id into c1;
  insert into public.ultima_competition (season_label, is_active) values ('b', false) returning id into c2;
  insert into public.ultima_managers (competition_id, user_id) values (c1, '11111111-1111-1111-1111-111111111111') returning id into m1;
  insert into public.ultima_managers (competition_id, user_id) values (c1, '22222222-2222-2222-2222-222222222222') returning id into m2;
  insert into public.ultima_managers (competition_id, user_id) values (c2, '33333333-3333-3333-3333-333333333333') returning id into m3;

  insert into public.ultima_notifications (manager_id, competition_id, kind, title) values
    (m1, c1, 'offer_received', 'm1 first'),
    (m1, c1, 'trade_executed', 'm1 second'),
    (m2, c1, 'offer_received', 'm2 only');
  insert into public.ultima_push_subscriptions (manager_id, endpoint, p256dh, auth) values
    (m1, 'https://push.example/1', 'p', 'a'),
    (m2, 'https://push.example/2', 'p', 'a');
  insert into public.ultima_broadcasts (competition_id, title, body) values (c1, 'Hello league', 'Body');
end $$;

create function tn.m(u text) returns uuid language sql as $$
  select id from public.ultima_managers where user_id = u::uuid $$;

-- 1. Reads are scoped to the signed-in manager.
begin;
select tn.setup();
grant select on public.ultima_notifications, public.ultima_push_subscriptions,
  public.ultima_broadcasts, public.ultima_managers to authenticated;
set local role authenticated;
select set_config('tn.uid', '11111111-1111-1111-1111-111111111111', true);
select tn.assert((select count(*) from public.ultima_notifications) = 2, 'u1 reads exactly their two notifications');
select tn.assert((select count(*) from public.ultima_notifications where title = 'm2 only') = 0, 'u1 cannot read u2 inbox');
select tn.assert((select count(*) from public.ultima_push_subscriptions) = 1, 'u1 reads only their subscription');
select tn.assert((select count(*) from public.ultima_push_subscriptions where endpoint = 'https://push.example/2') = 0, 'u1 cannot read u2 subscription');
select tn.assert((select count(*) from public.ultima_broadcasts) = 1, 'u1 reads the league broadcast');
select set_config('tn.uid', '22222222-2222-2222-2222-222222222222', true);
select tn.assert((select count(*) from public.ultima_notifications) = 1, 'u2 reads exactly their one notification');
select tn.assert((select title from public.ultima_notifications) = 'm2 only', 'u2 sees their own row');
-- A user outside the competition sees no broadcast, and nobody signed in sees nothing.
select set_config('tn.uid', '33333333-3333-3333-3333-333333333333', true);
select tn.assert((select count(*) from public.ultima_broadcasts) = 0, 'u3 in another competition cannot read the broadcast');
select tn.assert((select count(*) from public.ultima_notifications) = 0, 'u3 reads no notifications');
select set_config('tn.uid', '', true);
select tn.assert((select count(*) from public.ultima_notifications) = 0, 'no user, no rows');
rollback;

-- 2. Writes are refused. First as shipped (privileges revoked), then with
-- Supabase's default table grants put back, where row level security alone must hold.
begin;
select tn.setup();
grant select on public.ultima_notifications, public.ultima_push_subscriptions,
  public.ultima_broadcasts, public.ultima_managers to authenticated;
set local role authenticated;
select set_config('tn.uid', '11111111-1111-1111-1111-111111111111', true);
do $$
declare t text;
begin
  foreach t in array array['ultima_notifications', 'ultima_push_subscriptions', 'ultima_broadcasts'] loop
    begin
      execute format('delete from public.%I', t);
      raise exception 'FAIL: delete allowed on %', t;
    exception when insufficient_privilege then null; end;
    begin
      execute format('update public.%I set created_at = now()', t);
      raise exception 'FAIL: update allowed on %', t;
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    insert into public.ultima_notifications (manager_id, competition_id, kind, title)
    select id, competition_id, 'x', 'forged' from public.ultima_managers where user_id = '11111111-1111-1111-1111-111111111111';
    raise exception 'FAIL: insert allowed on notifications';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

begin;
select tn.setup();
grant all on public.ultima_notifications, public.ultima_push_subscriptions,
  public.ultima_broadcasts, public.ultima_managers to authenticated;
set local role authenticated;
select set_config('tn.uid', '11111111-1111-1111-1111-111111111111', true);
do $$
declare n int;
begin
  -- Their own row: no update policy, so nothing can change.
  update public.ultima_notifications set read_at = now() where title = 'm1 first';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: update touched % own rows', n; end if;
  delete from public.ultima_notifications where title = 'm1 first';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: delete touched % own rows', n; end if;
  -- Another manager's row.
  update public.ultima_notifications set read_at = now() where title = 'm2 only';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: update touched another manager row'; end if;
  delete from public.ultima_push_subscriptions;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: delete removed subscriptions'; end if;
  begin
    insert into public.ultima_notifications (manager_id, competition_id, kind, title)
    select id, competition_id, 'x', 'forged' from public.ultima_managers where user_id = '22222222-2222-2222-2222-222222222222';
    raise exception 'FAIL: insert into another inbox allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.ultima_push_subscriptions (manager_id, endpoint, p256dh, auth)
    select id, 'https://push.example/forged', 'p', 'a' from public.ultima_managers where user_id = '22222222-2222-2222-2222-222222222222';
    raise exception 'FAIL: subscription insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.ultima_broadcasts (competition_id, title, body)
    select competition_id, 'forged', 'x' from public.ultima_managers where user_id = '11111111-1111-1111-1111-111111111111';
    raise exception 'FAIL: broadcast insert allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

-- 3. The push status check, and the broadcast length checks.
begin;
select tn.setup();
do $$
declare c uuid; m uuid;
begin
  select id, competition_id into m, c from public.ultima_managers where user_id = '11111111-1111-1111-1111-111111111111';
  begin
    insert into public.ultima_notifications (manager_id, competition_id, kind, title, push_status) values (m, c, 'x', 'y', 'bogus');
    raise exception 'FAIL: bad push_status accepted';
  exception when check_violation then null; end;
  insert into public.ultima_notifications (manager_id, competition_id, kind, title, push_status, send_after)
  values (m, c, 'x', 'held one', 'held', now());
  begin
    insert into public.ultima_broadcasts (competition_id, title, body) values (c, repeat('x', 61), 'y');
    raise exception 'FAIL: 61 character title accepted';
  exception when check_violation then null; end;
  begin
    insert into public.ultima_broadcasts (competition_id, title, body) values (c, 'ok', repeat('y', 281));
    raise exception 'FAIL: 281 character message accepted';
  exception when check_violation then null; end;
  insert into public.ultima_broadcasts (competition_id, title, body) values (c, repeat('x', 60), repeat('y', 280));
  begin
    insert into public.ultima_push_subscriptions (manager_id, endpoint, p256dh, auth) values (m, 'https://push.example/1', 'p', 'a');
    raise exception 'FAIL: duplicate endpoint accepted';
  exception when unique_violation then null; end;
end $$;
rollback;

select 'notifications tests passed' as result;
