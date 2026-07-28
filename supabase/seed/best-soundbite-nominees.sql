-- Best Soundbite nominees. Idempotent upsert by fixed id.
-- Simon is first (sort 1). Corrects any live "Sil" title to Simon.
insert into public.nominees (id, category, title, youtube_id, context_line, sort, clip_start_seconds, nation)
values
  (
    '550e8400-e29b-41d4-a716-446655440702',
    'best-soundbite',
    'Simon',
    'uwauSqa1Qzs',
    'Your finger is offside',
    1,
    12,
    'England'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440701',
    'best-soundbite',
    'Alex',
    'uwauSqa1Qzs',
    'Football will win today, not corruption',
    2,
    6,
    'Spain'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440703',
    'best-soundbite',
    'Rita',
    'uwauSqa1Qzs',
    'Our favourite hooligan, gone by the 85th',
    3,
    39,
    'Belgium'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440704',
    'best-soundbite',
    'Faris & Ayaan',
    'uwauSqa1Qzs',
    'Ronaldo''s best achievement? Being compared to Messi',
    4,
    63,
    'Portugal'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440705',
    'best-soundbite',
    'Arnaud',
    'uwauSqa1Qzs',
    'Three generations came with the federation',
    5,
    80,
    'France'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440706',
    'best-soundbite',
    'Lucas',
    'uwauSqa1Qzs',
    'We need more shots, don''t let it end nil-nil',
    6,
    98,
    'England'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440707',
    'best-soundbite',
    'Gabriella',
    'uwauSqa1Qzs',
    'We needed more goals',
    7,
    123,
    'England'
  )
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  youtube_id = excluded.youtube_id,
  context_line = excluded.context_line,
  sort = excluded.sort,
  clip_start_seconds = excluded.clip_start_seconds,
  nation = excluded.nation;
