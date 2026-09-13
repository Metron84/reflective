-- The Crest: founding context and academy reputation (Section 1 patch).

alter table public.crest_clubs
  add column if not exists founding_context text,
  add column if not exists academy_reputation jsonb not null default '{}'::jsonb;

comment on column public.crest_clubs.exclusion_clubs is
  'Slugs referencing crest_clubs.slug. Unmatched slugs are expected and ignored until the full 60-club set is seeded.';
