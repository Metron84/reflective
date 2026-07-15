-- Clue ladder: five graded clues per player (hardest first).
-- Difficulty lives in the clue gradient; drop puzzle difficulty notes.

alter table public.players
  add column if not exists clues text[] not null default '{}';

alter table public.puzzles
  drop column if exists difficulty_notes;
