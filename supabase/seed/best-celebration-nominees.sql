-- Best Celebration nominees (unlisted YouTube). Idempotent upsert by fixed id.
insert into public.nominees (id, category, title, youtube_id, context_line, sort)
values
  (
    '550e8400-e29b-41d4-a716-446655440001',
    'best-celebration',
    'Scotland Fans: The Goal After 28 Years | World Cup 2026',
    'TjC0rN0GaUI',
    'The moment Dubai''s Tartan Army finally got to scream for a World Cup goal.',
    1
  ),
  (
    '550e8400-e29b-41d4-a716-446655440002',
    'best-celebration',
    'Japan Fans: Shocking Brazil | Half-Time Lead | World Cup 2026',
    'tcwbLM7z8rs',
    'Joy in blue on one side, heartbreak in yellow on the other. Half-time against Brazil.',
    2
  ),
  (
    '550e8400-e29b-41d4-a716-446655440003',
    'best-celebration',
    'England Fans: We Still Believe | Comeback Victory Against DR Congo | World Cup 2026',
    'jOf79qyp-HM',
    'Belief never left the room when the comeback landed against DR Congo.',
    3
  ),
  (
    '550e8400-e29b-41d4-a716-446655440004',
    'best-celebration',
    'Egypt Fans Penalties: Pure Pandemonium | Victory Against Australia | Round 32 World Cup 2026',
    'CDwr9w8ym64',
    'Flags, hugs, and noise when the penalties went Egypt''s way against Australia.',
    4
  )
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  youtube_id = excluded.youtube_id,
  context_line = excluded.context_line,
  sort = excluded.sort;
