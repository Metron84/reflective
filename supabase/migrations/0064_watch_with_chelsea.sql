-- Chelsea as club seven. Inactive at launch. ON CONFLICT DO NOTHING.

insert into public.watch_with_clubs
  (slug, name, short_name, fan_label, primary_color, accent_color, active, sort_order)
values
  ('chelsea', 'Chelsea', 'Chelsea', 'Blues', '#034694', '#6CA0DC', false, 7)
on conflict (slug) do nothing;

insert into public.watch_with_cards
  (id, club_slug, name, category, tagline, supporter_verified, active, source_note)
values
  ('chelsea-petr-cech', 'chelsea', 'Petr Cech', 'player', 'Never panics, and has the clean sheet record to prove it.', true, true, null),
  ('chelsea-peter-osgood', 'chelsea', 'Peter Osgood', 'player', 'King of the Bridge, so he expects the best seat.', true, true, null),
  ('chelsea-ngolo-kante', 'chelsea', 'N''Golo Kante', 'player', 'Quiet, smiling, and covers every inch of the room.', true, true, null),
  ('chelsea-ashley-cole', 'chelsea', 'Ashley Cole', 'player', 'Sharp, serious, and never beaten down the left.', true, true, null),
  ('chelsea-dennis-wise', 'chelsea', 'Dennis Wise', 'player', 'Wound up from kick-off and happy to start an argument.', true, true, null),
  ('chelsea-frank-lampard', 'chelsea', 'Frank Lampard', 'player', 'Counts every goal, 211 of them, and still wants one more.', true, true, null),
  ('chelsea-john-terry', 'chelsea', 'John Terry', 'player', 'Captain, leader, legend, and he will organise the whole pub.', true, true, null),
  ('chelsea-didier-drogba', 'chelsea', 'Didier Drogba', 'player', 'Silent until the big moment, then he takes over the room.', true, true, null),
  ('chelsea-eden-hazard', 'chelsea', 'Eden Hazard', 'player', 'Glides through the game and tells you to relax.', true, true, null),
  ('chelsea-gianfranco-zola', 'chelsea', 'Gianfranco Zola', 'player', 'Smiles at every trick and wants everyone to enjoy the game.', true, true, null),
  ('chelsea-thomas-tuchel', 'chelsea', 'Thomas Tuchel', 'manager', 'Intense, detailed, and has a plan for every set piece.', true, true, null),
  ('chelsea-guus-hiddink', 'chelsea', 'Guus Hiddink', 'manager', 'Calm, kind, and the friendliest man in the room.', true, true, null),
  ('chelsea-ruud-gullit', 'chelsea', 'Ruud Gullit', 'manager', 'Cool, stylish, and judges the football with a smile.', true, true, null),
  ('chelsea-claudio-ranieri', 'chelsea', 'Claudio Ranieri', 'manager', 'Changes his mind at half-time and makes it sound brilliant.', true, true, null),
  ('chelsea-emma-hayes', 'chelsea', 'Emma Hayes', 'manager', 'Reads every phase of play and tells you what happens next.', true, true, null),
  ('chelsea-jose-mourinho', 'chelsea', 'Jose Mourinho', 'manager', 'Tells you he is the special one, then proves it.', true, true, null),
  ('chelsea-carlo-ancelotti', 'chelsea', 'Carlo Ancelotti', 'manager', 'Raised eyebrow, relaxed shrug, and sees everything.', true, true, null),
  ('chelsea-antonio-conte', 'chelsea', 'Antonio Conte', 'manager', 'Shouts every instruction from the sofa as if he were on the touchline.', true, true, null),
  ('chelsea-roberto-di-matteo', 'chelsea', 'Roberto Di Matteo', 'manager', 'Quietly confident, and he has already won the big one.', true, true, null),
  ('chelsea-gianluca-vialli', 'chelsea', 'Gianluca Vialli', 'manager', 'Warm, stylish, and treats every match as a celebration.', true, true, null),
  ('chelsea-richard-attenborough', 'chelsea', 'Richard Attenborough', 'celebrity', 'Narrates the match like a classic film, and nobody interrupts.', true, true, null),
  ('chelsea-suggs', 'chelsea', 'Suggs', 'celebrity', 'Starts the singing and keeps it going until the final whistle.', true, true, null),
  ('chelsea-sebastian-coe', 'chelsea', 'Sebastian Coe', 'celebrity', 'Times every run, every substitution, and every final whistle.', true, true, null),
  ('chelsea-michael-caine', 'chelsea', 'Michael Caine', 'celebrity', 'Tells a story from the old days, and it is a good one.', true, true, null),
  ('chelsea-damon-albarn', 'chelsea', 'Damon Albarn', 'celebrity', 'Hums the tune of every chant and adds a harmony.', false, false, 'needs source before launch'),
  ('chelsea-emma-watson', 'chelsea', 'Emma Watson', 'celebrity', 'Quietly knows more than she lets on, then makes a sharp point.', false, false, 'needs source before launch'),
  ('chelsea-guy-ritchie', 'chelsea', 'Guy Ritchie', 'celebrity', 'Plots every move like a film and wants a second take.', false, false, 'needs source before launch'),
  ('chelsea-jeremy-clarkson', 'chelsea', 'Jeremy Clarkson', 'celebrity', 'Loud opinions, louder complaints, and a strong view on the referee.', false, false, 'needs source before launch'),
  ('chelsea-will-ferrell', 'chelsea', 'Will Ferrell', 'celebrity', 'Treats every corner like a scene and plays it for laughs.', false, false, 'needs source before launch')
on conflict (id) do nothing;
