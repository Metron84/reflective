-- READ ONLY. Ultima damage query 3 of 3.
-- Trades in accepted or review state (and held ones, once 0044 is applied), with
-- review end times. A negative hours_left means the review ended and nothing has
-- settled it yet.
select
  t.id as trade_id,
  t.state,
  mp.team_name as proposer_team,
  mr.team_name as receiver_team,
  t.created_at,
  t.review_expires_at,
  round((extract(epoch from (t.review_expires_at - now())) / 3600)::numeric, 1) as hours_left,
  (
    select count(distinct v.manager_id)
    from public.ultima_trade_votes v
    where v.trade_id = t.id and v.veto
  ) as veto_votes,
  (
    select string_agg(p.name, ', ' order by p.name)
    from public.ultima_trade_players tp
    join public.ultima_players p on p.id = tp.player_id
    where tp.trade_id = t.id and tp.from_manager_id = t.proposer_id
  ) as proposer_gives,
  (
    select string_agg(p.name, ', ' order by p.name)
    from public.ultima_trade_players tp
    join public.ultima_players p on p.id = tp.player_id
    where tp.trade_id = t.id and tp.from_manager_id = t.receiver_id
  ) as receiver_gives
from public.ultima_trades t
join public.ultima_managers mp on mp.id = t.proposer_id
join public.ultima_managers mr on mr.id = t.receiver_id
where t.state in ('accepted', 'review', 'awaiting_unlock')
order by t.review_expires_at nulls last
