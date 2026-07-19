-- Best Supporter nominees (shared YouTube with clip offsets). Idempotent upsert by fixed id.
insert into public.nominees (id, category, title, youtube_id, context_line, sort, clip_start_seconds)
values
  (
    '550e8400-e29b-41d4-a716-446655440301',
    'best-supporter',
    'Ayaan (Portugal)',
    'H6rhtaK4FJE',
    null,
    1,
    8
  ),
  (
    '550e8400-e29b-41d4-a716-446655440302',
    'best-supporter',
    'Carlotta (Spain)',
    'H6rhtaK4FJE',
    null,
    2,
    41
  ),
  (
    '550e8400-e29b-41d4-a716-446655440303',
    'best-supporter',
    'Ishaan (Japan)',
    'H6rhtaK4FJE',
    null,
    3,
    77
  ),
  (
    '550e8400-e29b-41d4-a716-446655440304',
    'best-supporter',
    'Janaina (Brazil)',
    'H6rhtaK4FJE',
    null,
    4,
    117
  ),
  (
    '550e8400-e29b-41d4-a716-446655440305',
    'best-supporter',
    'Lucas (England)',
    'H6rhtaK4FJE',
    null,
    5,
    177
  ),
  (
    '550e8400-e29b-41d4-a716-446655440306',
    'best-supporter',
    'Magnus (Norway)',
    'H6rhtaK4FJE',
    null,
    6,
    212
  ),
  (
    '550e8400-e29b-41d4-a716-446655440307',
    'best-supporter',
    'Niels (Belgium)',
    'H6rhtaK4FJE',
    null,
    7,
    253
  )
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  youtube_id = excluded.youtube_id,
  context_line = excluded.context_line,
  sort = excluded.sort,
  clip_start_seconds = excluded.clip_start_seconds;
