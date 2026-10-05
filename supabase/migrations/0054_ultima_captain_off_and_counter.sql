-- Applied to production 5 Oct 2026. Do not re-run.
-- Ultima captain_off column and atomic counter trade. Recorded as 0054_ultima_captain_off_and_counter.
-- Lets a manager remove a captain carried over from last week.
-- captain_off marks "no carry-over for this country this gameweek".
alter table public.ultima_lineups
  add column if not exists captain_off boolean not null default false;

-- Counter in one transaction: the original goes to 'countered' and the new offer
-- is inserted together, so a failure rolls both back and the original stays live.
create or replace function public.ultima_counter_trade(
  p_original_id uuid,
  p_proposer_id uuid,
  p_give uuid[],
  p_get uuid[],
  p_verdict jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  orig public.ultima_trades%rowtype;
  new_id uuid;
  pid uuid;
begin
  select * into orig from public.ultima_trades where id = p_original_id for update;
  if not found or orig.state <> 'proposed' or orig.receiver_id <> p_proposer_id then
    return jsonb_build_object('ok', false, 'code', 'NOT_OPEN');
  end if;

  update public.ultima_trades set state = 'countered', resolved_at = now() where id = orig.id;

  insert into public.ultima_trades (competition_id, proposer_id, receiver_id, state, verdict_json)
  values (orig.competition_id, p_proposer_id, orig.proposer_id, 'proposed', p_verdict)
  returning id into new_id;

  foreach pid in array p_give loop
    insert into public.ultima_trade_players (trade_id, player_id, from_manager_id, to_manager_id)
    values (new_id, pid, p_proposer_id, orig.proposer_id);
  end loop;
  foreach pid in array p_get loop
    insert into public.ultima_trade_players (trade_id, player_id, from_manager_id, to_manager_id)
    values (new_id, pid, orig.proposer_id, p_proposer_id);
  end loop;

  update public.ultima_trades set countered_by = new_id where id = orig.id;
  return jsonb_build_object('ok', true, 'trade_id', new_id);
end $$;

revoke all on function public.ultima_counter_trade(uuid, uuid, uuid[], uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.ultima_counter_trade(uuid, uuid, uuid[], uuid[], jsonb) to service_role;
