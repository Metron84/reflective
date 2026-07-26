-- Best Soundbite nominees. Idempotent upsert by fixed id.
insert into public.nominees (id, category, title, youtube_id, context_line, sort, clip_start_seconds)
values
  ('550e8400-e29b-41d4-a716-446655440701', 'best-soundbite', 'Alex', 'uwauSqa1Qzs', 'Football will win today', 1, 6),
  ('550e8400-e29b-41d4-a716-446655440702', 'best-soundbite', 'Simon', 'uwauSqa1Qzs', 'Your finger is offside', 2, 12),
  ('550e8400-e29b-41d4-a716-446655440703', 'best-soundbite', 'Rita', 'uwauSqa1Qzs', 'Our favorite hooligan', 3, 39),
  ('550e8400-e29b-41d4-a716-446655440704', 'best-soundbite', 'Faris & Ayaan', 'uwauSqa1Qzs', 'Ronaldo''s best achievement is being compared to Messi / The World Cup is rigged', 4, 63),
  ('550e8400-e29b-41d4-a716-446655440705', 'best-soundbite', 'Arnaud', 'uwauSqa1Qzs', 'Three generations', 5, 80),
  ('550e8400-e29b-41d4-a716-446655440706', 'best-soundbite', 'Lucas', 'uwauSqa1Qzs', 'We need more shots', 6, 98),
  ('550e8400-e29b-41d4-a716-446655440707', 'best-soundbite', 'Gabriella', 'uwauSqa1Qzs', 'We needed more goals', 7, 123)
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  youtube_id = excluded.youtube_id,
  context_line = excluded.context_line,
  sort = excluded.sort,
  clip_start_seconds = excluded.clip_start_seconds;
