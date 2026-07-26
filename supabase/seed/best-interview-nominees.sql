-- Best Interview nominees. Idempotent upsert by fixed id.
insert into public.nominees (id, category, title, youtube_id, context_line, sort, clip_start_seconds)
values
  ('550e8400-e29b-41d4-a716-446655440601', 'best-interview', 'Chef Mariano', '9KE_DfepN3w', null, 1, 10),
  ('550e8400-e29b-41d4-a716-446655440602', 'best-interview', 'Sara', '9KE_DfepN3w', null, 2, 85),
  ('550e8400-e29b-41d4-a716-446655440603', 'best-interview', 'Josh', '9KE_DfepN3w', null, 3, 128),
  ('550e8400-e29b-41d4-a716-446655440604', 'best-interview', 'Sven & Hilda', '9KE_DfepN3w', null, 4, 185),
  ('550e8400-e29b-41d4-a716-446655440605', 'best-interview', 'Levon', '9KE_DfepN3w', null, 5, 255),
  ('550e8400-e29b-41d4-a716-446655440606', 'best-interview', 'Stuart', '9KE_DfepN3w', null, 6, 315),
  ('550e8400-e29b-41d4-a716-446655440607', 'best-interview', 'Manu & Milan', '9KE_DfepN3w', null, 7, 389),
  ('550e8400-e29b-41d4-a716-446655440608', 'best-interview', 'Jafar', '9KE_DfepN3w', null, 8, 445)
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  youtube_id = excluded.youtube_id,
  context_line = excluded.context_line,
  sort = excluded.sort,
  clip_start_seconds = excluded.clip_start_seconds;
