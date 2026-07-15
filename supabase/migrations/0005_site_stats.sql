-- Home page stats: manual config + timestamped YouTube readings.
-- RLS enabled, no client policies (server-only).

create table if not exists public.site_stats (
  id smallint primary key default 1 check (id = 1),
  instagram_views bigint not null default 0,
  watch_hours bigint not null default 0,
  youtube_views_fallback bigint not null default 85500,
  youtube_channel_id text,
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_stats (
  id uuid primary key default gen_random_uuid(),
  view_count bigint not null,
  recorded_at timestamptz not null default now()
);

create index if not exists channel_stats_recorded_idx
  on public.channel_stats (recorded_at desc);

alter table public.site_stats enable row level security;
alter table public.channel_stats enable row level security;

insert into public.site_stats (
  id,
  instagram_views,
  watch_hours,
  youtube_views_fallback,
  updated_at
)
values (1, 517000, 1300, 85500, now())
on conflict (id) do update set
  instagram_views = excluded.instagram_views,
  watch_hours = excluded.watch_hours,
  youtube_views_fallback = excluded.youtube_views_fallback,
  updated_at = excluded.updated_at;

insert into public.channel_stats (view_count, recorded_at)
select 85500, now()
where not exists (select 1 from public.channel_stats limit 1);
