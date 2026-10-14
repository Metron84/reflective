-- My Programme honours: four new badge rows.
-- Run after 0066_fan_quiz_skipped.sql. Not applied by the My Programme revamp branch.
--
-- Unlock rules live in lib/account/badges.js:
--   perfect_ten     10 out of 10 correct in a fan_quiz_scores row.
--   no_safety_net   10 answered with skipped = 0 in a fan_quiz_scores row.
--   every_league    every Crest league revealed (awarded by POST /api/account/every-league).
--   codebreaker     first Codemaster rank above the starting rank (codemaster_solves count).
-- Awards land in user_badges, which already exists. No schema change.

insert into public.badges (slug, name, description, sort_order) values
  ('perfect_ten', 'Perfect Ten', 'Scored 10 out of 10 in Are You Really a Fan?', 8),
  ('no_safety_net', 'No Safety Net', 'Answered all ten questions with no skips.', 9),
  ('every_league', 'Every League', 'Revealed your club in every Crest league.', 10),
  ('codebreaker', 'Codebreaker', 'Earned your first Codemaster title.', 11)
on conflict (slug) do nothing;

-- Verify after running:
--   select slug, sort_order from public.badges order by sort_order;   -- 11 rows
