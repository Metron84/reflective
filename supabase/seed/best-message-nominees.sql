-- Best Message from the Fans nominees. Idempotent upsert by fixed id.
insert into public.nominees (id, category, title, youtube_id, context_line, sort, clip_start_seconds)
values
  ('550e8400-e29b-41d4-a716-446655440501', 'best-message', 'Nicole', 'UX56p4YAIR4', null, 1, 7),
  ('550e8400-e29b-41d4-a716-446655440502', 'best-message', 'Chef Mariano', 'UX56p4YAIR4', null, 2, 20),
  ('550e8400-e29b-41d4-a716-446655440503', 'best-message', 'Magnus', 'UX56p4YAIR4', null, 3, 84),
  ('550e8400-e29b-41d4-a716-446655440504', 'best-message', 'Manu', 'UX56p4YAIR4', null, 4, 113),
  ('550e8400-e29b-41d4-a716-446655440505', 'best-message', 'Stuart', 'UX56p4YAIR4', null, 5, 130),
  ('550e8400-e29b-41d4-a716-446655440506', 'best-message', 'Sara', 'UX56p4YAIR4', null, 6, 158),
  ('550e8400-e29b-41d4-a716-446655440507', 'best-message', 'Lunga & Lavoyo', 'UX56p4YAIR4', null, 7, 187)
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  youtube_id = excluded.youtube_id,
  context_line = excluded.context_line,
  sort = excluded.sort,
  clip_start_seconds = excluded.clip_start_seconds;
