-- Best Video nominees (shared YouTube with clip offsets). Idempotent upsert by fixed id.
insert into public.nominees (id, category, title, youtube_id, context_line, sort, clip_start_seconds)
values
  (
    '550e8400-e29b-41d4-a716-446655440101',
    'best-video',
    'Row or Die',
    'h4dTMLEXzhw',
    'Norway v Brazil',
    1,
    8
  ),
  (
    '550e8400-e29b-41d4-a716-446655440102',
    'best-video',
    'The Pharaoh''s Legacy',
    'h4dTMLEXzhw',
    'Egypt v Australia',
    2,
    44
  ),
  (
    '550e8400-e29b-41d4-a716-446655440103',
    'best-video',
    'Come Rain or Shine',
    'h4dTMLEXzhw',
    'Scotland v Morocco',
    3,
    70
  ),
  (
    '550e8400-e29b-41d4-a716-446655440104',
    'best-video',
    'They Invited Us Home',
    'h4dTMLEXzhw',
    'Spain v KSA',
    4,
    114
  )
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  youtube_id = excluded.youtube_id,
  context_line = excluded.context_line,
  sort = excluded.sort,
  clip_start_seconds = excluded.clip_start_seconds;
