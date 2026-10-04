-- READ ONLY. Ultima damage query 2 of 3.
-- XV rows in scored gameweeks (provisional or final) where the player was not on
-- that manager's squad at kickoff.
--
-- There is no squad history table, so ownership is replayed from the draft
-- picks, market signings and drops, and executed trades. "Kickoff" is the
-- moment the player's league opened that gameweek (the lock moment), or the
-- window start when that is missing. A pick later undone by the commissioner
-- leaves no record, so it reads as "never owned".
--
-- Points: ultima_player_match_stats holds goals, assists and rating. The base
-- points formula lives in code (goals x 3 + assists + rating band), so send me
-- the rows and I will compute the points credited. manager_gw_points is the
-- stored gameweek total for that manager.
with kick as (
  select
    l.manager_id,
    l.gameweek_id,
    l.slot,
    l.player_id,
    g.number as gameweek,
    g.state as gameweek_state,
    p.name as player_name,
    p.league,
    coalesce((g.league_open_at ->> p.league)::timestamptz, g.window_start) as kickoff
  from public.ultima_lineups l
  join public.ultima_gameweeks g on g.id = l.gameweek_id
  join public.ultima_players p on p.id = l.player_id
  where g.state in ('provisional', 'final')
    and l.player_id is not null
),
ev as (
  select manager_id, player_id, created_at as at, 'get' as kind
  from public.ultima_transactions where type = 'add'
  union all
  select manager_id, player_id, created_at, 'lose'
  from public.ultima_transactions where type = 'drop'
  union all
  select manager_id, player_id, picked_at, 'get'
  from public.ultima_draft_picks
  union all
  select tp.to_manager_id, tp.player_id, t.resolved_at, 'get'
  from public.ultima_trade_players tp
  join public.ultima_trades t on t.id = tp.trade_id
  where t.state = 'executed'
  union all
  select tp.from_manager_id, tp.player_id, t.resolved_at, 'lose'
  from public.ultima_trade_players tp
  join public.ultima_trades t on t.id = tp.trade_id
  where t.state = 'executed'
),
held as (
  select
    k.*,
    (
      select max(e.at) from ev e
      where e.manager_id = k.manager_id and e.player_id = k.player_id
        and e.kind = 'get' and e.at <= k.kickoff
    ) as last_get,
    (
      select max(e.at) from ev e
      where e.manager_id = k.manager_id and e.player_id = k.player_id
        and e.kind = 'lose' and e.at <= k.kickoff
    ) as last_lose
  from kick k
)
select
  m.team_name as manager_team,
  h.gameweek,
  h.gameweek_state,
  h.slot,
  h.player_name,
  h.league,
  h.kickoff,
  case
    when h.last_get is null then 'never owned before kickoff'
    else 'gone before kickoff'
  end as reason,
  coalesce(mo.team_name, 'nobody') as owner_now,
  stats.goals,
  stats.assists,
  stats.ratings,
  s.points as manager_gw_points,
  s.bolt_points as manager_gw_bolt_points
from held h
join public.ultima_managers m on m.id = h.manager_id
left join public.ultima_rosters r on r.player_id = h.player_id and r.competition_id = m.competition_id
left join public.ultima_managers mo on mo.id = r.manager_id
left join public.ultima_manager_gameweek_scores s
  on s.manager_id = h.manager_id and s.gameweek_id = h.gameweek_id
left join lateral (
  select
    sum(st.goals) as goals,
    sum(st.assists) as assists,
    array_agg(st.rating order by f.kickoff) as ratings
  from public.ultima_player_match_stats st
  join public.ultima_fixtures f on f.id = st.fixture_id
  where st.player_id = h.player_id and f.gameweek_id = h.gameweek_id
) stats on true
where h.last_get is null
   or (h.last_lose is not null and h.last_lose > h.last_get)
order by h.gameweek, m.team_name, h.slot
