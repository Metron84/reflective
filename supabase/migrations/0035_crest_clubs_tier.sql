-- The Crest: Tier A (deep) vs Tier B (light) club sets (~60 + ~160).
-- Run after 0034_crest_clubs_patch.sql.
-- Supersedes standalone crest_clubs_tier.sql (adds competition for result copy).

alter table public.crest_clubs
  add column if not exists tier text not null default 'B';

alter table public.crest_clubs
  add column if not exists competition text;

alter table public.crest_clubs
  add constraint crest_clubs_tier_check check (tier in ('A', 'B'));

-- Existing rows (sample / Tier A anchors) are deep tier until Tier B batches land.
update public.crest_clubs
set tier = 'A'
where tier = 'B';

create index if not exists crest_clubs_tier_research_status_idx
  on public.crest_clubs (tier, research_status);
