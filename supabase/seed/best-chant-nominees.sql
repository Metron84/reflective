-- Best Chant nominees (shared YouTube with clip offsets). Idempotent upsert by fixed id.
insert into public.nominees (id, category, title, youtube_id, context_line, sort, clip_start_seconds, nation)
values
  (
    '550e8400-e29b-41d4-a716-446655440401',
    'best-chant',
    'Shosholoza',
    '_ZShgaFPZOg',
    null,
    1,
    7,
    'South Africa'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440402',
    'best-chant',
    'The Dubai Tartan Army',
    '_ZShgaFPZOg',
    null,
    2,
    67,
    'Scotland'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440403',
    'best-chant',
    'Cielito Lindo',
    '_ZShgaFPZOg',
    null,
    3,
    86,
    'Mexico'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440404',
    'best-chant',
    'Where is the Party?',
    '_ZShgaFPZOg',
    null,
    4,
    105,
    'Belgium'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440405',
    'best-chant',
    'Row Row Row',
    '_ZShgaFPZOg',
    null,
    5,
    127,
    'Norway & Brazil'
  )
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  youtube_id = excluded.youtube_id,
  context_line = excluded.context_line,
  sort = excluded.sort,
  clip_start_seconds = excluded.clip_start_seconds,
  nation = excluded.nation;
