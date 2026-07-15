-- Badges for My Programme honours. Run after 0007_profiles_auth.sql.

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  sort_order integer not null default 0
);

create table if not exists public.user_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

insert into public.badges (slug, name, description, sort_order) values
  ('founding_fan', 'Founding Fan', 'Joined before the first Reflections winners.', 1),
  ('the_purist', 'The Purist', 'Solved a Guesser board with zero clues.', 2),
  ('the_deducer', 'The Deducer', 'Solved in two guesses or fewer.', 3),
  ('week_of_wins', 'Week of Wins', 'Seven-day Guesser win streak on Classic.', 4),
  ('month_of_wins', 'Month of Wins', 'Thirty-day Guesser win streak on Classic.', 5),
  ('full_ballot', 'Full Ballot', 'Voted in all eight Reflections categories.', 6),
  ('the_historian', 'The Historian', 'Solved ten World Cup Legends puzzles.', 7)
on conflict (slug) do nothing;

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

create policy "Badges: authenticated read catalogue"
  on public.badges
  for select
  to authenticated
  using (true);

create policy "User badges: read own"
  on public.user_badges
  for select
  to authenticated
  using (auth.uid() = user_id);
