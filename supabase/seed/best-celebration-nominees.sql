-- Best Celebration nominees (shared YouTube with clip offsets). Idempotent upsert by fixed id.
insert into public.nominees (id, category, title, youtube_id, context_line, sort, clip_start_seconds, nation)
values
  (
    '550e8400-e29b-41d4-a716-446655440001',
    'best-celebration',
    'The Goal After 28 Years',
    'iZqUA_V0HnM',
    'The moment Dubai''s Tartan Army finally got to scream for a World Cup goal.',
    1,
    7,
    'Scotland'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440002',
    'best-celebration',
    'Shocking Brazil at Half-Time',
    'iZqUA_V0HnM',
    'Joy in blue on one side, heartbreak in yellow on the other. Half-time against Brazil.',
    2,
    123,
    'Japan'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440003',
    'best-celebration',
    'We Still Believe',
    'iZqUA_V0HnM',
    'Belief never left the room when the comeback landed against DR Congo.',
    3,
    163,
    'England'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440004',
    'best-celebration',
    'Pure Pandemonium',
    'iZqUA_V0HnM',
    'Flags, hugs, and noise when the penalties went Egypt''s way against Australia.',
    4,
    358,
    'Egypt'
  )
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  youtube_id = excluded.youtube_id,
  context_line = excluded.context_line,
  sort = excluded.sort,
  clip_start_seconds = excluded.clip_start_seconds,
  nation = excluded.nation;
