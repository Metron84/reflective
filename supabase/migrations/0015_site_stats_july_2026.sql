-- Refresh Melo's manual channel figures (July 2026).
-- Safe on existing DBs: upserts site_stats row 1; adds impressions if missing.

alter table public.site_stats
  add column if not exists youtube_impressions bigint;

update public.site_stats
set
  instagram_views = 531070,
  watch_hours = 1700,
  youtube_views_fallback = 103813,
  youtube_impressions = 716386,
  updated_at = now()
where id = 1;

insert into public.site_stats (
  id,
  instagram_views,
  watch_hours,
  youtube_views_fallback,
  youtube_impressions,
  updated_at
)
values (1, 531070, 1700, 103813, 716386, now())
on conflict (id) do nothing;
