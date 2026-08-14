-- Ultima: seed bot personas + optional competition bootstrap.
-- Run after 0019_ultima.sql.
--
-- Personas mirror data/ultima/personas.json.
-- Commissioner: uncomment the competition bootstrap block once, then issue invites via admin (Phase J).

insert into public.ultima_bot_personas (
  id, name, risk, horizon, discipline, wobble, weights, rationale_lines
) values
  (
    'the_accountant',
    'The Accountant',
    0.1, 0.9, 0.9, 0.05,
    '{"goals_rate":0.4,"assists_rate":0.3,"rating_avg":0.8,"rating_consistency":0.9,"minutes_reliability":1.0,"club_strength":0.5,"fixtures_next":0.4,"draft_round":0.2}'::jsonb,
    '["Proven minutes. No drama.","Steady returns beat headlines.","The floor fills itself."]'::jsonb
  ),
  (
    'the_banker',
    'The Banker',
    0.2, 0.8, 0.5, 0.1,
    '{"goals_rate":0.5,"assists_rate":0.3,"rating_avg":0.5,"rating_consistency":0.4,"minutes_reliability":0.6,"club_strength":1.0,"fixtures_next":0.3,"draft_round":0.3}'::jsonb,
    '["Big club. Big name.","Everyone knows this one.","Safe on paper."]'::jsonb
  ),
  (
    'the_analyst',
    'The Analyst',
    0.3, 1.0, 1.0, 0.04,
    '{"goals_rate":0.7,"assists_rate":0.6,"rating_avg":0.9,"rating_consistency":0.8,"minutes_reliability":0.9,"club_strength":0.4,"fixtures_next":0.7,"draft_round":0.5}'::jsonb,
    '["The numbers say yes.","Season average wins here.","Floor handled on schedule."]'::jsonb
  ),
  (
    'the_pragmatist',
    'The Pragmatist',
    0.4, 0.6, 0.7, 0.08,
    '{"goals_rate":0.6,"assists_rate":0.5,"rating_avg":0.6,"rating_consistency":0.5,"minutes_reliability":0.7,"club_strength":0.5,"fixtures_next":0.5,"draft_round":0.4}'::jsonb,
    '["Obvious pick. Moving on.","Nothing clever. Just correct.","LaLiga floor ticked."]'::jsonb
  ),
  (
    'the_streaker',
    'The Streaker',
    0.5, 0.1, 0.4, 0.15,
    '{"goals_rate":1.0,"assists_rate":0.8,"rating_avg":0.3,"rating_consistency":-0.2,"minutes_reliability":0.2,"club_strength":0.2,"fixtures_next":0.9,"draft_round":0.7}'::jsonb,
    '["He scored last week.","Hot right now.","Form over everything."]'::jsonb
  ),
  (
    'the_contrarian',
    'The Contrarian',
    0.6, 0.5, 0.6, 0.12,
    '{"goals_rate":0.5,"assists_rate":0.4,"rating_avg":0.4,"rating_consistency":0.3,"minutes_reliability":0.5,"club_strength":-0.3,"fixtures_next":0.4,"draft_round":0.8}'::jsonb,
    '["Room wanted him. I did not.","Different lane.","Not the obvious name."]'::jsonb
  ),
  (
    'the_scout',
    'The Scout',
    0.8, 0.7, 0.8, 0.1,
    '{"goals_rate":0.6,"assists_rate":0.5,"rating_avg":0.5,"rating_consistency":0.4,"minutes_reliability":0.6,"club_strength":0.2,"fixtures_next":0.6,"draft_round":1.0}'::jsonb,
    '["Late rounds are where winners live.","Nobody else saw him.","Patience pays off."]'::jsonb
  ),
  (
    'the_gambler',
    'The Gambler',
    0.9, 0.2, 0.3, 0.18,
    '{"goals_rate":1.0,"assists_rate":0.4,"rating_avg":0.2,"rating_consistency":-0.3,"minutes_reliability":0.1,"club_strength":0.1,"fixtures_next":0.3,"draft_round":0.6}'::jsonb,
    '["Nobody has heard of him yet.","This is the one.","Boring is worse than wrong."]'::jsonb
  ),
  (
    'the_panicker',
    'The Panicker',
    0.7, 0.3, 0.1, 0.22,
    '{"goals_rate":0.8,"assists_rate":0.3,"rating_avg":0.2,"rating_consistency":-0.4,"minutes_reliability":0.3,"club_strength":0.3,"fixtures_next":0.8,"draft_round":0.9}'::jsonb,
    '["Need LaLiga. Anyone will do.","Clock is running.","Forced pick. Sorry."]'::jsonb
  )
on conflict (id) do update set
  name = excluded.name,
  risk = excluded.risk,
  horizon = excluded.horizon,
  discipline = excluded.discipline,
  wobble = excluded.wobble,
  weights = excluded.weights,
  rationale_lines = excluded.rationale_lines;

-- Optional one-time competition bootstrap (uncomment and run once):
--
-- insert into public.ultima_competition (season_label, timer_seconds, rating_thresholds)
-- values (
--   '2026/27',
--   60,
--   '{"pl":{"band1":7.0,"band2":7.5},"laliga":{"band1":7.0,"band2":7.5},"seriea":{"band1":7.0,"band2":7.5}}'::jsonb
-- );
--
-- insert into public.ultima_draft_state (competition_id, state)
-- select id, 'lobby' from public.ultima_competition where is_active = true limit 1;
