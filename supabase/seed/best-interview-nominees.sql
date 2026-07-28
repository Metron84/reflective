-- Best Interview nominees. Idempotent upsert by fixed id.
insert into public.nominees (id, category, title, youtube_id, context_line, sort, clip_start_seconds, nation)
values
  (
    '550e8400-e29b-41d4-a716-446655440601',
    'best-interview',
    'Chef Mariano',
    '9KE_DfepN3w',
    'Spain vs Cape Verde',
    1,
    10,
    'Spain'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440602',
    'best-interview',
    'Sara',
    '9KE_DfepN3w',
    '7-1 Trauma: Why Brazil Will Never Be Over It',
    2,
    85,
    'Brazil'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440603',
    'best-interview',
    'Josh',
    '9KE_DfepN3w',
    'Tuchel is the Tactical Mastermind We Need',
    3,
    128,
    'England'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440604',
    'best-interview',
    'Sven & Hilda',
    '9KE_DfepN3w',
    'The Real Story Behind Norway''s Row Row Chant',
    4,
    185,
    'Norway'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440605',
    'best-interview',
    'Levon',
    '9KE_DfepN3w',
    'On Mbappe, Ultras and FIFA',
    5,
    255,
    'France'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440606',
    'best-interview',
    'Stuart',
    '9KE_DfepN3w',
    'Why Scotland is the Most Honest Team at the World Cup',
    6,
    315,
    'Scotland'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440607',
    'best-interview',
    'Manu & Milan',
    '9KE_DfepN3w',
    'The Belgian Wall',
    7,
    389,
    'Belgium'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440608',
    'best-interview',
    'Jafar',
    '9KE_DfepN3w',
    'Why Football Belongs to the People',
    8,
    445,
    'Iraq'
  )
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  youtube_id = excluded.youtube_id,
  context_line = excluded.context_line,
  sort = excluded.sort,
  clip_start_seconds = excluded.clip_start_seconds,
  nation = excluded.nation;
