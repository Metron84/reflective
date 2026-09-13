-- Ground scene fields for The Crest arrival (Section 4+).
alter table public.crest_clubs
  add column if not exists "primary" text,
  add column if not exists secondary text,
  add column if not exists stadium_name text,
  add column if not exists skyline_variant smallint;

alter table public.crest_clubs
  drop constraint if exists crest_clubs_skyline_variant_check;

alter table public.crest_clubs
  add constraint crest_clubs_skyline_variant_check check (
    skyline_variant is null or (skyline_variant >= 1 and skyline_variant <= 6)
  );
