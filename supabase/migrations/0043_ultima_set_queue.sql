-- Atomic, conflict-checked draft queue save.
-- Additive: creates one function. No table or policy changes.
-- Replaces a manager's queue in one transaction. If the stored queue differs
-- from p_base_ids (the list the client loaded), nothing is written and the
-- current queue is returned so the client can reload it.

create or replace function public.ultima_set_queue(
  p_manager_id uuid,
  p_player_ids uuid[],
  p_base_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current uuid[];
begin
  -- One writer per manager at a time.
  perform 1 from public.ultima_managers where id = p_manager_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NO_MANAGER');
  end if;

  select coalesce(array_agg(player_id order by position), '{}'::uuid[])
    into v_current
    from public.ultima_draft_queues
   where manager_id = p_manager_id;

  if v_current is distinct from coalesce(p_base_ids, '{}'::uuid[]) then
    return jsonb_build_object('ok', false, 'code', 'QUEUE_CONFLICT', 'queue', to_jsonb(v_current));
  end if;

  delete from public.ultima_draft_queues where manager_id = p_manager_id;

  insert into public.ultima_draft_queues (manager_id, player_id, position)
  select p_manager_id, t.player_id, t.ord::integer
    from unnest(coalesce(p_player_ids, '{}'::uuid[])) with ordinality as t(player_id, ord);

  return jsonb_build_object('ok', true, 'saved', coalesce(cardinality(p_player_ids), 0));
end;
$$;

revoke all on function public.ultima_set_queue(uuid, uuid[], uuid[]) from public;
revoke all on function public.ultima_set_queue(uuid, uuid[], uuid[]) from anon, authenticated;
grant execute on function public.ultima_set_queue(uuid, uuid[], uuid[]) to service_role;
