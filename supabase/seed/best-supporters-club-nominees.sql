-- Best Supporters Club nominees (shared YouTube with clip offsets). Idempotent upsert by fixed id.
insert into public.nominees (id, category, title, youtube_id, context_line, sort, clip_start_seconds)
values
  (
    '550e8400-e29b-41d4-a716-446655440201',
    'best-supporters-club',
    'Scotland Supporters',
    'k1b1m6vVQwo',
    null,
    1,
    6
  ),
  (
    '550e8400-e29b-41d4-a716-446655440202',
    'best-supporters-club',
    'Belgium Supporters',
    'k1b1m6vVQwo',
    null,
    2,
    51
  ),
  (
    '550e8400-e29b-41d4-a716-446655440203',
    'best-supporters-club',
    'England Supporters',
    'k1b1m6vVQwo',
    null,
    3,
    97
  ),
  (
    '550e8400-e29b-41d4-a716-446655440204',
    'best-supporters-club',
    'Norway Supporters',
    'k1b1m6vVQwo',
    null,
    4,
    138
  )
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  youtube_id = excluded.youtube_id,
  context_line = excluded.context_line,
  sort = excluded.sort,
  clip_start_seconds = excluded.clip_start_seconds;
