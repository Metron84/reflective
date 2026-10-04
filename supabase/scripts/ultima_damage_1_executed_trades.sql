-- READ ONLY. Ultima damage query 1 of 3.
-- Executed trades where the players did not all move as recorded.
--
-- "now" ownership comes from ultima_rosters. A player who moved again after the
-- trade (later trade, drop or signing) shows explained_by_later_move = true, so
-- unexplained_players is the number to look at. A player on nobody's squad
-- reads "nobody" (the old execution deleted the giver's row before the insert
-- that could fail).
with deal as (
  select
    t.id as trade_id,
    t.competition_id,
    t.resolved_at as executed_at,
    t.proposer_id,
    t.receiver_id,
    tp.player_id,
    tp.from_manager_id,
    tp.to_manager_id,
    r.manager_id as owner_now
  from public.ultima_trades t
  join public.ultima_trade_players tp on tp.trade_id = t.id
  left join public.ultima_rosters r
    on r.player_id = tp.player_id
   and r.competition_id = t.competition_id
  where t.state = 'executed'
),
checked as (
  select
    d.*,
    (d.owner_now is not distinct from d.to_manager_id) as moved_ok,
    (
      exists (
        select 1 from public.ultima_transactions x
        where x.player_id = d.player_id and x.created_at > d.executed_at
      )
      or exists (
        select 1
        from public.ultima_trade_players tp2
        join public.ultima_trades t2 on t2.id = tp2.trade_id
        where tp2.player_id = d.player_id
          and t2.state = 'executed'
          and t2.id <> d.trade_id
          and t2.resolved_at > d.executed_at
      )
    ) as explained_by_later_move
  from deal d
)
select
  c.trade_id,
  c.executed_at,
  mp.team_name as proposer_team,
  mr.team_name as receiver_team,
  string_agg(p.name, ', ' order by p.name)
    filter (where c.from_manager_id = c.proposer_id) as proposer_gave,
  string_agg(p.name, ', ' order by p.name)
    filter (where c.from_manager_id = c.receiver_id) as receiver_gave,
  count(*) as players,
  count(*) filter (where c.moved_ok) as landed,
  count(*) filter (where not c.moved_ok and not c.explained_by_later_move) as unexplained_players,
  string_agg(
    p.name || ' (now: ' || coalesce(mo.team_name, 'nobody')
      || case when c.explained_by_later_move then ', moved later' else '' end || ')',
    ', ' order by p.name
  ) filter (where not c.moved_ok) as did_not_land
from checked c
join public.ultima_players p on p.id = c.player_id
join public.ultima_managers mp on mp.id = c.proposer_id
join public.ultima_managers mr on mr.id = c.receiver_id
left join public.ultima_managers mo on mo.id = c.owner_now
group by c.trade_id, c.executed_at, mp.team_name, mr.team_name
having bool_or(not c.moved_ok)
order by unexplained_players desc, c.executed_at
