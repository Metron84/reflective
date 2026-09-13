-- SAMPLE club vectors for The Crest. Idempotent upsert by slug.
-- research_status is forced to sample on every run.

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'real-madrid',
  'Real Madrid',
  'Real Madrid',
  'Madrid',
  null,
  'iberia-elite',
  '{1,4,1,1,3,4,2,2,2,5,1,4}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'Winning is not a hope here, it is the minimum, and the history is worn like a uniform.',
  '{"atletico-madrid","barcelona"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'barcelona',
  'Barcelona',
  'Barcelona',
  'Barcelona',
  null,
  'iberia-elite',
  '{3,5,2,3,7,6,7,7,4,6,5,6}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'A way of playing treated as a belief system, taught to children before they are trusted with the first team.',
  '{"real-madrid","espanyol"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'atletico-madrid',
  'Atletico Madrid',
  'Atletico Madrid',
  'Madrid',
  null,
  'iberia-elite',
  '{5,6,4,5,2,2,5,6,6,6,5,6}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'Built on resistance and effort, and proud that its glory has always been taken rather than expected.',
  '{"real-madrid"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'athletic-club',
  'Athletic Club',
  'Athletic Club',
  'Bilbao',
  null,
  'iberia-identity',
  '{5,4,6,7,5,4,7,7,7,7,6,7}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'Only Basque players, no exceptions, which makes every season a statement rather than a strategy.',
  '{"real-sociedad"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'everton',
  'Everton',
  'Everton',
  'Liverpool',
  null,
  'england-north',
  '{7,6,4,6,3,3,4,3,6,7,4,6}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'Loyalty here is measured in bad years, and the bad years are long.',
  '{"liverpool"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'liverpool',
  'Liverpool',
  'Liverpool',
  'Liverpool',
  null,
  'england-north',
  '{4,6,2,5,5,5,4,5,6,7,5,6}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'A city''s emotional language, sung before kickoff and carried a long way from home.',
  '{"everton","manchester-united"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'arsenal',
  'Arsenal',
  'Arsenal',
  'London',
  null,
  'england-london',
  '{4,5,3,4,7,6,6,6,4,6,3,5}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'An insistence on playing properly that has cost it as often as it has won.',
  '{"tottenham-hotspur"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'tottenham-hotspur',
  'Tottenham Hotspur',
  'Tottenham Hotspur',
  'London',
  null,
  'england-london',
  '{6,6,4,5,5,5,5,4,5,5,4,5}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'Ambition and heartbreak in the same shirt, year after year, told with dark humour.',
  '{"arsenal"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'manchester-city',
  'Manchester City',
  'Manchester City',
  'Manchester',
  null,
  'england-north',
  '{1,3,3,2,6,4,3,7,3,3,2,3}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'A single idea executed to the last centimetre, with the resources to keep executing it.',
  '{"manchester-united"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'manchester-united',
  'Manchester United',
  'Manchester United',
  'Manchester',
  null,
  'england-north',
  '{2,5,1,3,5,5,6,4,4,6,2,4}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'Youth, comebacks and scale, a club that became a global habit.',
  '{"manchester-city","liverpool"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'newcastle-united',
  'Newcastle United',
  'Newcastle United',
  'Newcastle',
  null,
  'england-north',
  '{6,6,4,6,3,4,4,3,7,6,4,6}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'One city, one club, and a crowd that turns up whatever the table says.',
  '{}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'celtic',
  'Celtic',
  'Celtic',
  'Glasgow',
  null,
  'scotland',
  '{4,6,3,6,5,5,5,4,6,7,6,7}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'Founded to feed the poor of the East End, and it has never let anyone forget it.',
  '{"rangers"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'juventus',
  'Juventus',
  'Juventus',
  'Turin',
  null,
  'italy',
  '{2,4,2,2,3,3,5,3,4,6,2,5}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'Control, pragmatism and a quiet certainty that winning is the only argument.',
  '{"torino","inter-milan"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'napoli',
  'Napoli',
  'Napoli',
  'Naples',
  null,
  'italy',
  '{5,7,5,6,6,6,4,4,7,6,6,7}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'A city that treats its team as proof of itself against the north.',
  '{}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'roma',
  'Roma',
  'Roma',
  'Rome',
  null,
  'italy',
  '{7,7,4,7,5,5,5,4,7,6,5,7}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'Devotion far out of proportion to what the club gives back, and that is the deal.',
  '{"lazio"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'borussia-dortmund',
  'Borussia Dortmund',
  'Borussia Dortmund',
  'Dortmund',
  null,
  'germany',
  '{4,6,4,5,6,6,6,5,6,5,5,6}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'A wall of eighty thousand, young players trusted early, and a refusal to be the safe option.',
  '{"schalke-04"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'bayern-munich',
  'Bayern Munich',
  'Bayern Munich',
  'Munich',
  null,
  'germany',
  '{1,3,2,2,5,4,5,5,5,6,1,4}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'Order, standards and a habit of winning that the rest of the league builds itself around.',
  '{}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'st-pauli',
  'St Pauli',
  'St Pauli',
  'Hamburg',
  null,
  'germany',
  '{6,5,7,7,4,5,5,4,7,5,7,7}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'A football club used as a position, where the stand matters more than the table.',
  '{"hamburger-sv"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'ajax',
  'Ajax',
  'Ajax',
  'Amsterdam',
  null,
  'netherlands',
  '{3,4,4,4,7,6,7,7,5,6,4,5}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'An idea about football, taught, exported, and rebuilt from schoolboys every few years.',
  '{"feyenoord"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'marseille',
  'Marseille',
  'Marseille',
  'Marseille',
  null,
  'france',
  '{6,7,4,6,5,6,5,4,7,6,6,7}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'Volatile, southern and permanently at war with the capital.',
  '{"paris-saint-germain"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'al-ahly',
  'Al Ahly',
  'Al Ahly',
  'Cairo',
  null,
  'arab',
  '{2,5,2,3,4,4,5,4,6,7,3,6}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'The most decorated club in Africa, and a fixture of Egyptian public life for a century.',
  '{"zamalek"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'wydad-casablanca',
  'Wydad Casablanca',
  'Wydad Casablanca',
  'Casablanca',
  null,
  'arab',
  '{5,7,4,6,4,5,5,4,7,6,6,7}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'A crowd that sings for ninety minutes whatever happens, in a city that answers back.',
  '{"raja-casablanca"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'al-hilal',
  'Al Hilal',
  'Al Hilal',
  'Riyadh',
  null,
  'arab',
  '{1,4,2,2,4,4,3,3,5,5,2,4}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'Built to win continentally, and it usually does.',
  '{"al-nassr"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();

insert into public.crest_clubs (
  slug, name, common_name, city, country, cluster,
  vector, confidence, identity_summary, exclusion_clubs,
  founding_context, academy_reputation,
  vector_version, research_status, source_quality_notes
) values (
  'al-ain',
  'Al Ain',
  'Al Ain',
  'Al Ain',
  null,
  'arab',
  '{3,5,4,4,4,4,6,4,7,6,3,5}'::smallint[],
  '{3,3,3,3,3,3,3,3,3,3,3,3}'::smallint[],
  'The Emirates'' most successful club, rooted in its own city rather than the coast.',
  '{"shabab-al-ahli"}'::text[],
  null,
  '{"rating":null,"evidence":null,"source":null}'::jsonb,
  '1.1',
  'sample',
  'SAMPLE editorial estimate, not researched. Replace with Perplexity batch output.'
)
on conflict (slug) do update set
  name = excluded.name,
  common_name = excluded.common_name,
  city = excluded.city,
  country = excluded.country,
  cluster = excluded.cluster,
  vector = excluded.vector,
  confidence = excluded.confidence,
  identity_summary = excluded.identity_summary,
  exclusion_clubs = excluded.exclusion_clubs,
  founding_context = excluded.founding_context,
  academy_reputation = excluded.academy_reputation,
  vector_version = excluded.vector_version,
  research_status = 'sample',
  source_quality_notes = excluded.source_quality_notes,
  tier = 'A',
  updated_at = now();
