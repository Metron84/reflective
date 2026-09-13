-- The Crest: home-shirt colour family used as a hard quiz veto.
-- One of twelve words. Split shirts pick the colour people mean.

alter table public.crest_clubs
  add column if not exists kit_family text;

alter table public.crest_clubs
  drop constraint if exists crest_clubs_kit_family_check;

alter table public.crest_clubs
  add constraint crest_clubs_kit_family_check check (
    kit_family is null
    or kit_family in (
      'red',
      'blue',
      'white',
      'black',
      'purple',
      'yellow',
      'green',
      'orange',
      'pink',
      'brown',
      'grey',
      'claret'
    )
  );
