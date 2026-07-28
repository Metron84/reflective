-- Best Message from the Fans nominees. Idempotent upsert by fixed id.
-- KEEP EMPTY context_line for Chef Mariano, Stuart, Sara, Lunga & Lavoyo (Melo to fill).
insert into public.nominees (id, category, title, youtube_id, context_line, sort, clip_start_seconds, nation)
values
  (
    '550e8400-e29b-41d4-a716-446655440501',
    'best-message',
    'Nicole',
    'UX56p4YAIR4',
    'I believe in you the most',
    1,
    7,
    'England'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440502',
    'best-message',
    'Chef Mariano',
    'UX56p4YAIR4',
    null,
    2,
    20,
    'Spain'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440503',
    'best-message',
    'Magnus',
    'UX56p4YAIR4',
    'Only Norway can stop Norway',
    3,
    84,
    'Norway'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440504',
    'best-message',
    'Manu',
    'UX56p4YAIR4',
    '11 million people',
    4,
    113,
    'Belgium'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440505',
    'best-message',
    'Stuart',
    'UX56p4YAIR4',
    null,
    5,
    130,
    'Scotland'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440506',
    'best-message',
    'Sara',
    'UX56p4YAIR4',
    null,
    6,
    158,
    'Brazil'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440507',
    'best-message',
    'Lunga & Lavoyo',
    'UX56p4YAIR4',
    null,
    7,
    187,
    'South Africa'
  )
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  youtube_id = excluded.youtube_id,
  -- Preserve a non-null line when this seed passes null (KEEP EMPTY rows for Melo).
  context_line = coalesce(excluded.context_line, nominees.context_line),
  sort = excluded.sort,
  clip_start_seconds = excluded.clip_start_seconds,
  nation = excluded.nation;
