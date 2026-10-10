-- Fan identity for watch-with. Service role only.
-- Loads the five club card seeds when watch_with_cards only has West Ham.

insert into public.watch_with_cards
  (id, club_slug, name, category, tagline, supporter_verified, active, source_note)
values
  ('spurs-jimmy-greaves', 'spurs', 'Jimmy Greaves', 'player', '220 league goals, and he still says you should have shot.', true, true, null),
  ('spurs-glenn-hoddle', 'spurs', 'Glenn Hoddle', 'player', 'Sees the pass nobody else can, then explains it twice.', true, true, null),
  ('spurs-ledley-king', 'spurs', 'Ledley King', 'player', 'Quiet, calm, and the only one who never lunges.', true, true, null),
  ('spurs-dave-mackay', 'spurs', 'Dave Mackay', 'player', 'Sits with his arms folded and nobody dares move his chair.', true, true, null),
  ('spurs-danny-blanchflower', 'spurs', 'Danny Blanchflower', 'player', 'Wants the game played with style, and will say so loudly.', true, true, null),
  ('spurs-harry-kane', 'spurs', 'Harry Kane', 'player', 'Keeps count of every goal, his own included.', true, true, null),
  ('spurs-son-heung-min', 'spurs', 'Son Heung-min', 'player', 'Smiles through a 0-0 and hugs the whole row after a goal.', true, true, null),
  ('spurs-david-ginola', 'spurs', 'David Ginola', 'player', 'Treats a dull first half as a personal insult.', true, true, null),
  ('spurs-mousa-dembele', 'spurs', 'Mousa Dembele', 'player', 'Never rushes, never panics, and never gives you the ball back.', true, true, null),
  ('spurs-rafael-van-der-vaart', 'spurs', 'Rafael van der Vaart', 'player', 'Gets louder every time Arsenal lose.', true, true, null),
  ('spurs-bill-nicholson', 'spurs', 'Bill Nicholson', 'manager', 'Wants it done properly and will tell you when it is not.', true, true, null),
  ('spurs-keith-burkinshaw', 'spurs', 'Keith Burkinshaw', 'manager', 'Straight talker with a dry line for every occasion.', true, true, null),
  ('spurs-arthur-rowe', 'spurs', 'Arthur Rowe', 'manager', 'Wants it quick: push it, run into space, repeat.', true, true, null),
  ('spurs-mauricio-pochettino', 'spurs', 'Mauricio Pochettino', 'manager', 'Has you pressing from the stands by the second half.', true, true, null),
  ('spurs-harry-redknapp', 'spurs', 'Harry Redknapp', 'manager', 'Always has a bargain signing and a story to go with it.', true, true, null),
  ('spurs-martin-jol', 'spurs', 'Martin Jol', 'manager', 'Warm, funny, and never tells you to calm down.', true, true, null),
  ('spurs-ange-postecoglou', 'spurs', 'Ange Postecoglou', 'manager', 'Says we attack until the end, so the whole pub attacks too.', true, true, null),
  ('spurs-terry-venables', 'spurs', 'Terry Venables', 'manager', 'Always has a plan on a napkin and a story to go with it.', true, true, null),
  ('spurs-juande-ramos', 'spurs', 'Juande Ramos', 'manager', 'Few words, lots of focus, no small talk.', true, true, null),
  ('spurs-john-cameron', 'spurs', 'John Cameron', 'manager', 'Won the 1901 FA Cup, so he asks what you have won.', true, true, null),
  ('spurs-adele', 'spurs', 'Adele', 'celebrity', 'Sings along to everything and swears at the referee in the same breath.', true, true, null),
  ('spurs-tom-holland', 'spurs', 'Tom Holland', 'celebrity', 'Loses his voice by half-time and does not care.', true, true, null),
  ('spurs-jude-law', 'spurs', 'Jude Law', 'celebrity', 'Has been going for decades and tells it calmly.', true, true, null),
  ('spurs-kenneth-branagh', 'spurs', 'Kenneth Branagh', 'celebrity', 'Narrates the match like a Shakespeare play.', true, true, null),
  ('spurs-steve-nash', 'spurs', 'Steve Nash', 'celebrity', 'Plays every pass in his head before the player does.', true, true, null),
  ('spurs-michael-mcintyre', 'spurs', 'Michael McIntyre', 'celebrity', 'Turns every near miss into a five-minute routine.', true, true, null),
  ('spurs-paul-whitehouse', 'spurs', 'Paul Whitehouse', 'celebrity', 'Has an impression for every player and every ref.', true, true, null),
  ('spurs-jk-rowling', 'spurs', 'J.K. Rowling', 'celebrity', 'Knows the lore of the club better than anyone in the pub.', false, false, 'needs source before launch'),
  ('spurs-bob-marley', 'spurs', 'Bob Marley', 'celebrity', 'Keeps it calm, keeps it positive, and plays after the final whistle.', false, false, 'needs source before launch'),
  ('spurs-zac-efron', 'spurs', 'Zac Efron', 'celebrity', 'Shirt on, scarf on, first to the pub.', false, false, 'needs source before launch'),
  ('arsenal-thierry-henry', 'arsenal', 'Thierry Henry', 'player', '228 goals, and he still explains where the space was.', true, true, null),
  ('arsenal-dennis-bergkamp', 'arsenal', 'Dennis Bergkamp', 'player', 'Says nothing for 80 minutes, then the one perfect observation.', true, true, null),
  ('arsenal-tony-adams', 'arsenal', 'Tony Adams', 'player', 'Never sits down and will not let you either.', true, true, null),
  ('arsenal-ian-wright', 'arsenal', 'Ian Wright', 'player', 'Celebrates every goal like he scored it, and every win like a title.', true, true, null),
  ('arsenal-patrick-vieira', 'arsenal', 'Patrick Vieira', 'player', 'Takes charge of the room and the seating plan.', true, true, null),
  ('arsenal-robert-pires', 'arsenal', 'Robert Pires', 'player', 'Elegant, calm, and always right about the pass.', true, true, null),
  ('arsenal-david-seaman', 'arsenal', 'David Seaman', 'player', 'Safe hands, calm head, and never drops your pint.', true, true, null),
  ('arsenal-freddie-ljungberg', 'arsenal', 'Freddie Ljungberg', 'player', 'Wild hair, wild celebrations, loudest in the room.', true, true, null),
  ('arsenal-ray-parlour', 'arsenal', 'Ray Parlour', 'player', 'Local lad, loud, and always ready for a long shot.', true, true, null),
  ('arsenal-bukayo-saka', 'arsenal', 'Bukayo Saka', 'player', 'Smiles through everything and has the whole pub smiling.', true, true, null),
  ('arsenal-arsene-wenger', 'arsenal', 'Arsene Wenger', 'manager', 'Tells you calmly that you did not see the tackle.', true, true, null),
  ('arsenal-herbert-chapman', 'arsenal', 'Herbert Chapman', 'manager', 'Arrives with a tactics board and a plan for the next ten years.', true, true, null),
  ('arsenal-george-graham', 'arsenal', 'George Graham', 'manager', 'Wants a clean sheet and silence until the final whistle.', true, true, null),
  ('arsenal-mikel-arteta', 'arsenal', 'Mikel Arteta', 'manager', 'Cannot stay in his seat and will not stop gesturing.', true, true, null),
  ('arsenal-harry-bradshaw', 'arsenal', 'Harry Bradshaw', 'manager', 'Laid the foundations a century ago and wants the credit.', true, true, null),
  ('arsenal-bertie-mee', 'arsenal', 'Bertie Mee', 'manager', 'Started as the physio, so he asks who is injured first.', true, true, null),
  ('arsenal-terry-neill', 'arsenal', 'Terry Neill', 'manager', 'Believes in the comeback until the final second.', true, true, null),
  ('arsenal-george-allison', 'arsenal', 'George Allison', 'manager', 'Steady hand, calm voice, never rattled.', true, true, null),
  ('arsenal-unai-emery', 'arsenal', 'Unai Emery', 'manager', 'Has a plan for everything and a spreadsheet for the rest.', true, true, null),
  ('arsenal-daniel-kaluuya', 'arsenal', 'Daniel Kaluuya', 'celebrity', 'Narrates the whole match, and it sounds like a documentary.', true, true, null),
  ('arsenal-idris-elba', 'arsenal', 'Idris Elba', 'celebrity', 'Brings the sound system and the strong opinions.', true, true, null),
  ('arsenal-lewis-hamilton', 'arsenal', 'Lewis Hamilton', 'celebrity', 'Wants the fastest possible counter-attack.', true, true, null),
  ('arsenal-colin-firth', 'arsenal', 'Colin Firth', 'celebrity', 'Lives every last-minute goal as if it were Fever Pitch.', true, true, null),
  ('arsenal-dua-lipa', 'arsenal', 'Dua Lipa', 'celebrity', 'Dances through every goal.', true, true, null),
  ('arsenal-mick-jagger', 'arsenal', 'Mick Jagger', 'celebrity', 'Makes the whole stand feel like a stadium gig.', true, true, null),
  ('arsenal-jamie-foxx', 'arsenal', 'Jamie Foxx', 'celebrity', 'Starts a chant, then keeps going for 90 minutes.', true, true, null),
  ('arsenal-jay-z', 'arsenal', 'Jay-Z', 'celebrity', 'Arrives late, takes the best seat, and stays very calm.', false, false, 'needs source before launch'),
  ('arsenal-rihanna', 'arsenal', 'Rihanna', 'celebrity', 'Fashion first, football second, and the whole row is watching her.', false, false, 'needs source before launch'),
  ('arsenal-piers-morgan', 'arsenal', 'Piers Morgan', 'celebrity', 'Argues with everyone on the timeline in real time.', false, false, 'needs source before launch'),
  ('liverpool-kenny-dalglish', 'liverpool', 'Kenny Dalglish', 'player', 'Sees the pass before it happens and says nothing.', true, true, null),
  ('liverpool-steven-gerrard', 'liverpool', 'Steven Gerrard', 'player', 'Never stops believing, especially at 3-0 down.', true, true, null),
  ('liverpool-ian-rush', 'liverpool', 'Ian Rush', 'player', 'Waits for the one chance, then settles it.', true, true, null),
  ('liverpool-john-barnes', 'liverpool', 'John Barnes', 'player', 'Cool, smooth, and never flustered.', true, true, null),
  ('liverpool-luis-suarez', 'liverpool', 'Luis Suarez', 'player', 'Wins every duel and argues every decision.', true, true, null),
  ('liverpool-mohamed-salah', 'liverpool', 'Mohamed Salah', 'player', 'Silent until the goal, then the whole room chants his name.', true, true, null),
  ('liverpool-robbie-fowler', 'liverpool', 'Robbie Fowler', 'player', 'The fans call him God, and he celebrates like one.', true, true, null),
  ('liverpool-jamie-carragher', 'liverpool', 'Jamie Carragher', 'player', 'Shouts at every defender like he is still on the pitch.', true, true, null),
  ('liverpool-virgil-van-dijk', 'liverpool', 'Virgil van Dijk', 'player', 'Calm, composed, and never lunges.', true, true, null),
  ('liverpool-roberto-firmino', 'liverpool', 'Roberto Firmino', 'player', 'Smiles, works harder than anyone, and wants everyone involved.', true, true, null),
  ('liverpool-bill-shankly', 'liverpool', 'Bill Shankly', 'manager', 'Makes you feel this match matters more than anything.', true, true, null),
  ('liverpool-bob-paisley', 'liverpool', 'Bob Paisley', 'manager', 'Says very little and wins everything.', true, true, null),
  ('liverpool-jurgen-klopp', 'liverpool', 'Jurgen Klopp', 'manager', 'Hugs everyone at the final whistle, win or lose.', true, true, null),
  ('liverpool-rafael-benitez', 'liverpool', 'Rafael Benitez', 'manager', 'Has a note for every set piece and shares it at half-time.', true, true, null),
  ('liverpool-gerard-houllier', 'liverpool', 'Gerard Houllier', 'manager', 'Calm, thoughtful, and happy to explain the long game.', true, true, null),
  ('liverpool-joe-fagan', 'liverpool', 'Joe Fagan', 'manager', 'Quiet, modest, and quietly wins a treble.', true, true, null),
  ('liverpool-roy-evans', 'liverpool', 'Roy Evans', 'manager', 'Wants entertaining football and a good time after.', true, true, null),
  ('liverpool-brendan-rodgers', 'liverpool', 'Brendan Rodgers', 'manager', 'Talks about the process through every near miss.', true, true, null),
  ('liverpool-ronnie-moran', 'liverpool', 'Ronnie Moran', 'manager', 'Has been at the club for decades and tells you every story.', true, true, null),
  ('liverpool-phil-thompson', 'liverpool', 'Phil Thompson', 'manager', 'Passionate, loud, and certain about every decision.', true, true, null),
  ('liverpool-daniel-craig', 'liverpool', 'Daniel Craig', 'celebrity', 'Never spills his drink, however tense it gets.', true, true, null),
  ('liverpool-lebron-james', 'liverpool', 'LeBron James', 'celebrity', 'Studies every pass like it is a play from the playbook.', true, true, null),
  ('liverpool-samuel-l-jackson', 'liverpool', 'Samuel L. Jackson', 'celebrity', 'Delivers every opinion at full volume and full conviction.', true, true, null),
  ('liverpool-liam-neeson', 'liverpool', 'Liam Neeson', 'celebrity', 'Calm voice, intense stare, and a particular set of opinions.', true, true, null),
  ('liverpool-mike-myers', 'liverpool', 'Mike Myers', 'celebrity', 'Does the voices, the chants, and the accents.', true, true, null),
  ('liverpool-dr-dre', 'liverpool', 'Dr. Dre', 'celebrity', 'Brings the music for the walk to the ground.', true, true, null),
  ('liverpool-lana-del-rey', 'liverpool', 'Lana Del Rey', 'celebrity', 'Quiet, moody, and cheers only at the best moments.', true, true, null),
  ('liverpool-millie-bobby-brown', 'liverpool', 'Millie Bobby Brown', 'celebrity', 'Loud, excited, and thrilled to be there.', true, true, null),
  ('liverpool-clive-owen', 'liverpool', 'Clive Owen', 'celebrity', 'Calm narrator, calm commentary, calm even at 90 minutes.', true, true, null),
  ('liverpool-angelina-jolie', 'liverpool', 'Angelina Jolie', 'celebrity', 'Quiet, focused, and always has the best seat.', false, false, 'needs source before launch'),
  ('aston-villa-paul-mcgrath', 'aston-villa', 'Paul McGrath', 'player', 'The fans call him God, and he stays calm like one.', true, true, null),
  ('aston-villa-john-mcginn', 'aston-villa', 'John McGinn', 'player', 'Never stops running, never stops talking, never stops celebrating.', true, true, null),
  ('aston-villa-jack-grealish', 'aston-villa', 'Jack Grealish', 'player', 'Boyhood fan, so he knows the chants and the pub.', true, true, null),
  ('aston-villa-gordon-cowans', 'aston-villa', 'Gordon Cowans', 'player', 'Calm, wise, and always sees the pass.', true, true, null),
  ('aston-villa-dwight-yorke', 'aston-villa', 'Dwight Yorke', 'player', 'Smiles at everything, including a 0-0.', true, true, null),
  ('aston-villa-peter-withe', 'aston-villa', 'Peter Withe', 'player', 'Tells the story of the 1982 winner every time.', true, true, null),
  ('aston-villa-stiliyan-petrov', 'aston-villa', 'Stiliyan Petrov', 'player', 'Humble, brave, and the most popular man in the stand.', true, true, null),
  ('aston-villa-dennis-mortimer', 'aston-villa', 'Dennis Mortimer', 'player', 'Led the team to Europe and still leads the room.', true, true, null),
  ('aston-villa-ian-taylor', 'aston-villa', 'Ian Taylor', 'player', 'Lived the dream and is happy to retell it.', true, true, null),
  ('aston-villa-emiliano-martinez', 'aston-villa', 'Emiliano Martinez', 'player', 'Fiery, loud, and ready to wind up the opposition.', true, true, null),
  ('aston-villa-unai-emery', 'aston-villa', 'Unai Emery', 'manager', 'Talks about the next match during this one.', true, true, null),
  ('aston-villa-ron-saunders', 'aston-villa', 'Ron Saunders', 'manager', 'Hard, serious, and quietly proud of the 1981 title.', true, true, null),
  ('aston-villa-tony-barton', 'aston-villa', 'Tony Barton', 'manager', 'Steps up quietly and wins the biggest prize.', true, true, null),
  ('aston-villa-brian-little', 'aston-villa', 'Brian Little', 'manager', 'Won the League Cup as a player and a manager, and tells you twice.', true, true, null),
  ('aston-villa-dean-smith', 'aston-villa', 'Dean Smith', 'manager', 'Boyhood fan who knows every chant.', true, true, null),
  ('aston-villa-george-ramsay', 'aston-villa', 'George Ramsay', 'manager', 'Won six titles and six cups, so he is hard to argue with.', true, true, null),
  ('aston-villa-graham-taylor', 'aston-villa', 'Graham Taylor', 'manager', 'Shouts instructions from the stand, whether or not you asked.', true, true, null),
  ('aston-villa-ron-atkinson', 'aston-villa', 'Ron Atkinson', 'manager', 'Talks loud, dresses louder, and enjoys himself most.', true, true, null),
  ('aston-villa-martin-oneill', 'aston-villa', 'Martin O''Neill', 'manager', 'Intense, driven, and winding up the whole row.', true, true, null),
  ('aston-villa-john-gregory', 'aston-villa', 'John Gregory', 'manager', 'Confident, chatty, and sure the title is next.', true, true, null),
  ('aston-villa-prince-william', 'aston-villa', 'Prince William', 'celebrity', 'Knows the fans, the chants, and the stands from his school days.', true, true, null),
  ('aston-villa-tom-hanks', 'aston-villa', 'Tom Hanks', 'celebrity', 'Picked the club because it sounded like a lovely holiday, and stayed.', true, true, null),
  ('aston-villa-ozzy-osbourne', 'aston-villa', 'Ozzy Osbourne', 'celebrity', 'Loudest voice in the stand and the loudest laugh.', true, true, null),
  ('aston-villa-david-bradley', 'aston-villa', 'David Bradley', 'celebrity', 'Celebrates on the pitch if you let him.', true, true, null),
  ('aston-villa-nigel-kennedy', 'aston-villa', 'Nigel Kennedy', 'celebrity', 'Wild, eccentric, and fully committed to the cause.', true, true, null),
  ('aston-villa-lee-child', 'aston-villa', 'Lee Child', 'celebrity', 'Names the characters after the players and quietly takes notes.', true, true, null),
  ('aston-villa-brendan-gleeson', 'aston-villa', 'Brendan Gleeson', 'celebrity', 'Quiet, wry, and a very good storyteller.', true, true, null),
  ('aston-villa-ian-bell', 'aston-villa', 'Ian Bell', 'celebrity', 'Quiet, studious, and keeps a score of everything.', true, true, null),
  ('aston-villa-mark-williams', 'aston-villa', 'Mark Williams', 'celebrity', 'Warm, funny, and cheers every goal like a family dinner.', true, true, null),
  ('aston-villa-greg-davies', 'aston-villa', 'Greg Davies', 'celebrity', 'Towering, sarcastic, and blocks the view in the best way.', true, true, null),
  ('rangers-john-greig', 'rangers', 'John Greig', 'player', 'Greatest ever Ranger, and he will not let you forget it.', true, true, null),
  ('rangers-ally-mccoist', 'rangers', 'Ally McCoist', 'player', 'Has a joke for every goal and a story for every miss.', true, true, null),
  ('rangers-jim-baxter', 'rangers', 'Jim Baxter', 'player', 'Treats every dull moment as an excuse to show off.', true, true, null),
  ('rangers-alan-morton', 'rangers', 'Alan Morton', 'player', 'Small, quick, and always on the move.', true, true, null),
  ('rangers-steven-davis', 'rangers', 'Steven Davis', 'player', 'Quiet, steady, and the calmest in the stand.', true, true, null),
  ('rangers-brian-laudrup', 'rangers', 'Brian Laudrup', 'player', 'Elegant, relaxed, and always one step ahead.', true, true, null),
  ('rangers-paul-gascoigne', 'rangers', 'Paul Gascoigne', 'player', 'Pure entertainment from the first minute to the last.', true, true, null),
  ('rangers-richard-gough', 'rangers', 'Richard Gough', 'player', 'Shouts instructions and leads the singing.', true, true, null),
  ('rangers-barry-ferguson', 'rangers', 'Barry Ferguson', 'player', 'Home-grown captain who takes every defeat personally.', true, true, null),
  ('rangers-jorg-albertz', 'rangers', 'Jorg Albertz', 'player', 'A thunderous left foot and a thunderous laugh.', true, true, null),
  ('rangers-bill-struth', 'rangers', 'Bill Struth', 'manager', 'Won 18 league titles, so every opinion lands.', true, true, null),
  ('rangers-walter-smith', 'rangers', 'Walter Smith', 'manager', 'Gravelly, honest, and always has a story from the Nine in a Row.', true, true, null),
  ('rangers-william-wilton', 'rangers', 'William Wilton', 'manager', 'The club''s first manager and the proudest in the stand.', true, true, null),
  ('rangers-graeme-souness', 'rangers', 'Graeme Souness', 'manager', 'Fiery, blunt, and not afraid to tell you off.', true, true, null),
  ('rangers-jock-wallace', 'rangers', 'Jock Wallace', 'manager', 'Barks orders, trains hard, and wants you fit for the second half.', true, true, null),
  ('rangers-steven-gerrard', 'rangers', 'Steven Gerrard', 'manager', 'Brings title-winning intensity and hates a draw.', true, true, null),
  ('rangers-alex-mcleish', 'rangers', 'Alex McLeish', 'manager', 'Big Eck stays calm and keeps the plan going.', true, true, null),
  ('rangers-dick-advocaat', 'rangers', 'Dick Advocaat', 'manager', 'The Little General wants every detail planned.', true, true, null),
  ('rangers-scot-symon', 'rangers', 'Scot Symon', 'manager', 'Quiet, steady, and always dressed for the occasion.', true, true, null),
  ('rangers-giovanni-van-bronckhorst', 'rangers', 'Giovanni van Bronckhorst', 'manager', 'Calm, classy, and still emotional about that European run.', true, true, null),
  ('rangers-gordon-ramsay', 'rangers', 'Gordon Ramsay', 'celebrity', 'Shouts at the referee like he is in a kitchen.', true, true, null),
  ('rangers-angus-young', 'rangers', 'Angus Young', 'celebrity', 'Loud, fast, and plays air guitar through every chant.', true, true, null),
  ('rangers-drew-mcintyre', 'rangers', 'Drew McIntyre', 'celebrity', 'Brings the wrestling entrance to every goal.', true, true, null),
  ('rangers-colin-montgomerie', 'rangers', 'Colin Montgomerie', 'celebrity', 'Quiet, then very loud at the key moment.', true, true, null),
  ('rangers-simon-neil', 'rangers', 'Simon Neil', 'celebrity', 'Sings every chant like a stadium anthem.', true, true, null),
  ('rangers-hugh-grant', 'rangers', 'Hugh Grant', 'celebrity', 'Charming and dry, and willing to do anything for a ticket.', true, true, null),
  ('rangers-tom-stoltman', 'rangers', 'Tom Stoltman', 'celebrity', 'Big enough to carry the whole row, and he might.', true, true, null),
  ('rangers-amy-macdonald', 'rangers', 'Amy Macdonald', 'celebrity', 'Sings every chant and knows every word.', true, true, null),
  ('rangers-robert-carlyle', 'rangers', 'Robert Carlyle', 'celebrity', 'Intense, focused, and fully in character.', true, true, null),
  ('rangers-marti-pellow', 'rangers', 'Marti Pellow', 'celebrity', 'Sings loudest and loves the day most.', true, true, null)
on conflict (id) do nothing;

create table if not exists public.watch_with_fans (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  user_id uuid references auth.users (id) on delete set null,
  email text unique,
  first_name text,
  location text check (location is null or location in ('dubai', 'uae-other', 'uk', 'elsewhere')),
  supporters_club text,
  email_verified boolean not null default false,
  consent_save_result boolean not null,
  consent_marketing boolean not null default false,
  consent_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists watch_with_fans_email_lower_idx
  on public.watch_with_fans (lower(email));

alter table public.watch_with_runs
  add column if not exists fan_id uuid references public.watch_with_fans (id) on delete set null;

create index if not exists watch_with_runs_fan_idx
  on public.watch_with_runs (fan_id);

alter table public.watch_with_fans enable row level security;

create or replace view public.watch_with_verified_results
with (security_invoker = true) as
with qualified as (
  select s.club_slug, s.winner_id, s.loser_id
  from public.watch_with_swipes s
  join public.watch_with_runs r on r.id = s.run_id
  join public.watch_with_fans f on f.id = r.fan_id
  where r.fan_id is not null
    and f.email_verified = true
),
wins as (
  select club_slug, winner_id as card_id, count(*)::int as wins
  from qualified
  group by club_slug, winner_id
),
losses as (
  select club_slug, loser_id as card_id, count(*)::int as losses
  from qualified
  group by club_slug, loser_id
)
select
  coalesce(w.club_slug, l.club_slug) as club_slug,
  coalesce(w.card_id, l.card_id) as card_id,
  coalesce(w.wins, 0) as wins,
  coalesce(l.losses, 0) as losses,
  (coalesce(w.wins, 0) + coalesce(l.losses, 0)) as votes,
  case
    when coalesce(w.wins, 0) + coalesce(l.losses, 0) = 0 then 0
    else coalesce(w.wins, 0)::numeric / (coalesce(w.wins, 0) + coalesce(l.losses, 0))
  end as win_rate
from wins w
full outer join losses l
  on w.club_slug = l.club_slug
 and w.card_id = l.card_id;

create or replace view public.watch_with_fan_results
with (security_invoker = true) as
with qualified as (
  select s.club_slug, s.winner_id, s.loser_id
  from public.watch_with_swipes s
  join public.watch_with_runs r on r.id = s.run_id
  where r.fan_id is not null
    and r.affiliation = 'fan'
),
wins as (
  select club_slug, winner_id as card_id, count(*)::int as wins
  from qualified
  group by club_slug, winner_id
),
losses as (
  select club_slug, loser_id as card_id, count(*)::int as losses
  from qualified
  group by club_slug, loser_id
)
select
  coalesce(w.club_slug, l.club_slug) as club_slug,
  coalesce(w.card_id, l.card_id) as card_id,
  coalesce(w.wins, 0) as wins,
  coalesce(l.losses, 0) as losses,
  (coalesce(w.wins, 0) + coalesce(l.losses, 0)) as votes,
  case
    when coalesce(w.wins, 0) + coalesce(l.losses, 0) = 0 then 0
    else coalesce(w.wins, 0)::numeric / (coalesce(w.wins, 0) + coalesce(l.losses, 0))
  end as win_rate
from wins w
full outer join losses l
  on w.club_slug = l.club_slug
 and w.card_id = l.card_id;
