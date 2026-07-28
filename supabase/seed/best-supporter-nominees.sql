-- Best Supporter nominees (shared YouTube with clip offsets). Idempotent upsert by fixed id.
insert into public.nominees (id, category, title, youtube_id, context_line, sort, clip_start_seconds, nation)
values
  (
    '550e8400-e29b-41d4-a716-446655440301',
    'best-supporter',
    'Ayaan',
    'H6rhtaK4FJE',
    null,
    1,
    8,
    'Portugal'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440302',
    'best-supporter',
    'Carlotta',
    'H6rhtaK4FJE',
    null,
    2,
    41,
    'Spain'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440303',
    'best-supporter',
    'Ishaan',
    'H6rhtaK4FJE',
    null,
    3,
    77,
    'Japan'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440304',
    'best-supporter',
    'Janaina',
    'H6rhtaK4FJE',
    null,
    4,
    118,
    'Brazil'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440305',
    'best-supporter',
    'Lucas',
    'H6rhtaK4FJE',
    null,
    5,
    163,
    'England'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440306',
    'best-supporter',
    'Magnus',
    'H6rhtaK4FJE',
    null,
    6,
    212,
    'Norway'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440307',
    'best-supporter',
    'Niels',
    'H6rhtaK4FJE',
    null,
    7,
    253,
    'Belgium'
  )
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  youtube_id = excluded.youtube_id,
  context_line = excluded.context_line,
  sort = excluded.sort,
  clip_start_seconds = excluded.clip_start_seconds,
  nation = excluded.nation;
