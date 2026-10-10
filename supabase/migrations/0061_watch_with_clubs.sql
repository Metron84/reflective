-- Multi-club watch-with. Clubs and cards sit beside watch_with_runs.
-- Service role only. No anon or authenticated policies.

create table if not exists public.watch_with_clubs (
  slug text primary key,
  name text not null,
  short_name text not null,
  fan_label text not null,
  primary_color text not null,
  accent_color text not null,
  active boolean not null default false,
  sort_order int not null
);

create table if not exists public.watch_with_cards (
  id text primary key,
  club_slug text not null references public.watch_with_clubs (slug),
  name text not null,
  category text not null check (category in ('player', 'manager', 'celebrity')),
  tagline text not null,
  supporter_verified boolean not null default true,
  active boolean not null default true,
  source_note text
);

alter table public.watch_with_runs
  add column if not exists affiliation text;

alter table public.watch_with_runs
  drop constraint if exists watch_with_runs_affiliation_check;

alter table public.watch_with_runs
  add constraint watch_with_runs_affiliation_check
  check (affiliation is null or affiliation in ('fan', 'neutral', 'rival'));

alter table public.watch_with_ratings
  add column if not exists segment text not null default 'all';

alter table public.watch_with_ratings
  drop constraint if exists watch_with_ratings_pkey;

alter table public.watch_with_ratings
  drop constraint if exists watch_with_ratings_segment_check;

alter table public.watch_with_ratings
  add constraint watch_with_ratings_segment_check
  check (segment in ('all', 'fan', 'rival'));

alter table public.watch_with_ratings
  add primary key (card_id, club_slug, segment);

create index if not exists watch_with_swipes_club_created_idx
  on public.watch_with_swipes (club_slug, created_at);

create index if not exists watch_with_ratings_segment_elo_idx
  on public.watch_with_ratings (club_slug, segment, elo desc);

insert into public.watch_with_clubs
  (slug, name, short_name, fan_label, primary_color, accent_color, active, sort_order)
values
  ('west-ham', 'West Ham United', 'West Ham', 'Hammers', '#7A263A', '#1BB1E7', true, 1),
  ('spurs', 'Tottenham Hotspur', 'Spurs', 'Spurs fans', '#132257', '#C8CFDB', false, 2),
  ('arsenal', 'Arsenal', 'Arsenal', 'Gooners', '#EF0107', '#FF3B3F', false, 3),
  ('liverpool', 'Liverpool', 'Liverpool', 'Reds', '#C8102E', '#FF3B4F', false, 4),
  ('aston-villa', 'Aston Villa', 'Villa', 'Villans', '#670E36', '#95BFE5', false, 5),
  ('rangers', 'Rangers', 'Rangers', 'Rangers fans', '#1B458F', '#5B8DEF', false, 6)
on conflict (slug) do nothing;

insert into public.watch_with_cards
  (id, club_slug, name, category, tagline, supporter_verified, active, source_note)
values
  ('billy-bonds', 'west-ham', 'Billy Bonds', 'player', 'Never sits down, never backs down, 799 games of grit.', true, true, null),
  ('trevor-brooking', 'west-ham', 'Trevor Brooking', 'player', 'Calm, wise, and will explain exactly why we lost.', true, true, null),
  ('julian-dicks', 'west-ham', 'Julian Dicks', 'player', 'Will shout at the ref for 90 minutes and mean it.', true, true, null),
  ('carlos-tevez', 'west-ham', 'Carlos Tevez', 'player', 'Silent until the 89th minute, then he saves your season.', true, true, null),
  ('bobby-moore', 'west-ham', 'Bobby Moore', 'player', 'Flawless composure while the pub falls apart around him.', true, true, null),
  ('geoff-hurst', 'west-ham', 'Geoff Hurst', 'player', 'Brings the hat-trick and the stories that go with it.', true, true, null),
  ('paolo-di-canio', 'west-ham', 'Paolo Di Canio', 'player', 'Pure chaos, and the best celebration in the pub.', true, true, null),
  ('mark-noble', 'west-ham', 'Mark Noble', 'player', 'Knows every fan by name and cries at the anthem.', true, true, null),
  ('harry-redknapp', 'west-ham', 'Harry Redknapp', 'manager', 'Reads the game through the window of a car.', true, true, null),
  ('slaven-bilic', 'west-ham', 'Slaven Bilic', 'manager', 'Sings every chant louder than you.', true, true, null),
  ('sam-allardyce', 'west-ham', 'Sam Allardyce', 'manager', 'Will tell you 1-0 away is a good result, and he is right.', true, true, null),
  ('ron-greenwood', 'west-ham', 'Ron Greenwood', 'manager', 'Quietly explains how the beautiful game should be played.', true, true, null),
  ('john-lyall', 'west-ham', 'John Lyall', 'manager', 'The calmest man in the stand when it is 0-0.', true, true, null),
  ('david-moyes', 'west-ham', 'David Moyes', 'manager', 'Nervy, tactical, and sure he can still sort the second half.', true, true, null),
  ('ray-winstone', 'west-ham', 'Ray Winstone', 'celebrity', 'Gravel voice, proper East End, wins every pub argument.', true, true, null),
  ('danny-dyer', 'west-ham', 'Danny Dyer', 'celebrity', 'Loud, unfiltered, and will start a chant at 3-0 down.', true, true, null),
  ('lennox-lewis', 'west-ham', 'Lennox Lewis', 'celebrity', 'Calm giant, and nobody argues with his seat.', true, true, null),
  ('elijah-wood', 'west-ham', 'Elijah Wood', 'celebrity', 'The Green Street convert who knows every word of every song.', true, true, null),
  ('keira-knightley', 'west-ham', 'Keira Knightley', 'celebrity', 'Pub at 11am and perfectly happy about it.', true, true, null),
  ('steve-harris', 'west-ham', 'Steve Harris', 'celebrity', 'Brings the volume and the stories from the road.', true, true, null),
  ('james-corden', 'west-ham', 'James Corden', 'celebrity', 'Never stops talking, mostly about Mark Noble.', true, true, null),
  ('nick-frost', 'west-ham', 'Nick Frost', 'celebrity', 'Knows the stats, the line-ups, and who was injured in 2004.', false, false, 'needs source before launch'),
  ('john-cleese', 'west-ham', 'John Cleese', 'celebrity', 'Dry, sarcastic, and will insult the referee with great style.', false, false, 'needs source before launch'),
  ('alfred-hitchcock', 'west-ham', 'Alfred Hitchcock', 'celebrity', 'Tense, silent, and enjoying your suffering.', false, false, 'needs source before launch'),
  ('matt-damon', 'west-ham', 'Matt Damon', 'celebrity', 'Polite, quiet, and secretly very invested.', false, false, 'needs source before launch')
on conflict (id) do nothing;

alter table public.watch_with_clubs enable row level security;
alter table public.watch_with_cards enable row level security;

create or replace function public.watch_with_apply_ratings(p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  updated int;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'ratings payload is not valid';
  end if;

  for item in select value from jsonb_array_elements(p_rows)
  loop
    if item->>'segment' not in ('all', 'fan', 'rival') then
      raise exception 'segment is not valid';
    end if;

    if (item->>'votes_before')::int = 0 and not exists (
      select 1 from public.watch_with_ratings
      where card_id = item->>'card_id'
        and club_slug = item->>'club_slug'
        and segment = item->>'segment'
    ) then
      insert into public.watch_with_ratings (card_id, club_slug, segment, elo, votes, wins)
      values (
        item->>'card_id',
        item->>'club_slug',
        item->>'segment',
        (item->>'elo')::numeric,
        1,
        case when (item->>'win')::boolean then 1 else 0 end
      );
    else
      update public.watch_with_ratings
      set elo = (item->>'elo')::numeric,
          votes = votes + 1,
          wins = wins + case when (item->>'win')::boolean then 1 else 0 end
      where card_id = item->>'card_id'
        and club_slug = item->>'club_slug'
        and segment = item->>'segment'
        and votes = (item->>'votes_before')::int;
      get diagnostics updated = row_count;
      if updated <> 1 then
        raise exception 'rating-race';
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.watch_with_apply_ratings(jsonb) from public, anon, authenticated;
grant execute on function public.watch_with_apply_ratings(jsonb) to service_role;
