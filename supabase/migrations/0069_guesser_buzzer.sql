-- The Guesser buzzer game: 5 players a day, scored out of 20, Dubai day.
-- Run after 0068_crest_reveals.sql. NOT applied by the feat/guesser-buzzer branch.
--
-- One plays row per board: mode = 'buzzer', puzzle_date = the Dubai day, guesses holds the run
-- ({v, rev, players[]}) and score holds the board total. The existing unique indexes
-- (user_id, puzzle_date, mode) and (session_hash, puzzle_date, mode) already make it one board
-- per member or per signed-out session per day. No change to them.
-- Old plays rows (league modes) are untouched.

alter table public.plays
  add column if not exists score integer not null default 0;

create index if not exists plays_buzzer_user_idx
  on public.plays (user_id, puzzle_date desc)
  where mode = 'buzzer' and user_id is not null;

-- Daily pick: the 5 person ids for a Dubai day. Written by the server (service role) the first
-- time a day is requested. A row here overrides the built-in schedule, so Melo can swap a day.
create table if not exists public.guesser_boards (
  board_date date primary key,
  person_ids text[] not null,
  created_at timestamptz not null default now(),
  constraint guesser_boards_five check (cardinality(person_ids) = 5)
);

alter table public.guesser_boards enable row level security;
-- No policies: clients get zero access. Server routes use the service role.

-- Honours remapped to the buzzer game. Existing user_badges stay earned.
update public.badges set description = 'Named a player on the first clue for 4 points.' where slug = 'the_purist';
update public.badges set description = 'Scored 16 or more out of 20 on a daily board.' where slug = 'the_deducer';
update public.badges set description = 'Scored 10 or more on seven Dubai days in a row.' where slug = 'week_of_wins';
update public.badges set description = 'Scored 10 or more on thirty Dubai days in a row.' where slug = 'month_of_wins';
update public.badges set description = 'Named ten World Cup Legends players correctly.' where slug = 'the_historian';

-- Verify after running:
--   select column_name from information_schema.columns where table_name = 'plays' and column_name = 'score';
--   select count(*) from public.guesser_boards;                       -- 0 until the first board is served
--   select slug, description from public.badges where slug in ('the_purist','the_deducer','week_of_wins','month_of_wins','the_historian');
