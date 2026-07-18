const LOG_PREFIX = "[youtube-stats]";
const CHANNEL_HANDLE =
  process.env.YOUTUBE_CHANNEL_HANDLE ?? "TheReflectiveFootball";
const REFRESH_MS = 12 * 60 * 1000;

async function fetchYouTubeViews(apiKey, channelId) {
  const params = new URLSearchParams({
    part: "statistics",
    id: channelId,
    key: apiKey,
  });
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?${params}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    let errorBody = null;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = { parseError: "response was not JSON" };
    }
    console.error(`${LOG_PREFIX} fetch views failed`, {
      status: res.status,
      channelId,
      error: errorBody?.error ?? errorBody,
    });
    return null;
  }

  const data = await res.json();
  const count = data?.items?.[0]?.statistics?.viewCount;
  const viewCount = count != null ? Number(count) : null;

  if (viewCount == null) {
    console.error(`${LOG_PREFIX} fetch views missing viewCount`, {
      channelId,
      itemCount: data?.items?.length ?? 0,
    });
    return null;
  }

  console.info(`${LOG_PREFIX} fetch views ok`, { channelId, viewCount });
  return viewCount;
}

async function resolveChannelId(apiKey, handle) {
  const byHandle = new URLSearchParams({
    part: "id",
    forHandle: handle.replace(/^@/, ""),
    key: apiKey,
  });
  let res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?${byHandle}`,
    { cache: "no-store" }
  );
  if (res.ok) {
    const data = await res.json();
    const id = data?.items?.[0]?.id;
    if (id) return id;
  }

  const bySearch = new URLSearchParams({
    part: "snippet",
    q: handle,
    type: "channel",
    maxResults: "1",
    key: apiKey,
  });
  res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${bySearch}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.items?.[0]?.snippet?.channelId ?? null;
}

async function getSiteStats(supabase) {
  const { data } = await supabase
    .from("site_stats")
    .select("*")
    .eq("id", 1)
    .single();
  return (
    data ?? {
      instagram_views: 517000,
      watch_hours: 1300,
      youtube_views_fallback: 85500,
      youtube_channel_id: null,
    }
  );
}

async function getRecentReadings(supabase, limit = 2) {
  const { data } = await supabase
    .from("channel_stats")
    .select("view_count, recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

async function maybeRefreshYouTube(supabase, site, { force = false } = {}) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn(`${LOG_PREFIX} refresh skipped: YOUTUBE_API_KEY not set`);
    return null;
  }

  const readings = await getRecentReadings(supabase, 1);
  const latest = readings[0];

  if (!force && latest?.recorded_at) {
    const age = Date.now() - new Date(latest.recorded_at).getTime();
    if (age < REFRESH_MS) {
      console.info(`${LOG_PREFIX} refresh skipped: reading younger than 12m`, {
        ageMinutes: Math.round(age / 60000),
        viewCount: latest.view_count,
      });
      return latest.view_count;
    }
  }

  let channelId = site.youtube_channel_id;
  if (!channelId) {
    channelId = await resolveChannelId(apiKey, CHANNEL_HANDLE);
    if (channelId) {
      await supabase
        .from("site_stats")
        .update({
          youtube_channel_id: channelId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      console.info(`${LOG_PREFIX} resolved channel id`, {
        channelId,
        handle: CHANNEL_HANDLE,
      });
    } else {
      console.error(`${LOG_PREFIX} channel id resolve failed`, {
        handle: CHANNEL_HANDLE,
      });
    }
  }

  if (!channelId) {
    return latest?.view_count ?? null;
  }

  const views = await fetchYouTubeViews(apiKey, channelId);
  if (views == null) {
    return latest?.view_count ?? null;
  }

  const recordedAt = new Date().toISOString();
  const { error: insertError } = await supabase.from("channel_stats").insert({
    view_count: views,
    recorded_at: recordedAt,
  });

  if (insertError) {
    console.error(`${LOG_PREFIX} channel_stats insert failed`, {
      channelId,
      viewCount: views,
      message: insertError.message,
    });
    return latest?.view_count ?? null;
  }

  console.info(`${LOG_PREFIX} channel_stats reading inserted`, {
    channelId,
    viewCount: views,
    recordedAt,
  });

  return views;
}

function computeVelocity(readings) {
  if (readings.length < 2) return 0;
  const [newest, older] = readings;
  const dt =
    (new Date(newest.recorded_at).getTime() -
      new Date(older.recorded_at).getTime()) /
    60000;
  if (dt <= 0) return 0;
  return Math.max(0, (newest.view_count - older.view_count) / dt);
}

const FALLBACK = {
  combinedViews: 602500,
  watchHours: 1300,
  anchorAt: Date.now(),
  viewsPerMinute: 0,
};

/** Force a YouTube refresh and insert (cron). Bypasses the 12-minute throttle. */
export async function refreshChannelStatsForCron() {
  const { getServiceClient } = await import("@/lib/supabase");
  const supabase = getServiceClient();
  if (!supabase) {
    console.error(`${LOG_PREFIX} cron refresh failed: supabase unreachable`);
    return { ok: false, error: "supabase_unavailable" };
  }

  try {
    const site = await getSiteStats(supabase);
    const viewCount = await maybeRefreshYouTube(supabase, site, { force: true });
    if (viewCount == null) {
      console.error(`${LOG_PREFIX} cron refresh failed: no view count returned`);
      return { ok: false, error: "refresh_failed" };
    }
    return { ok: true, viewCount };
  } catch (err) {
    console.error(`${LOG_PREFIX} cron refresh error`, {
      message: err?.message ?? String(err),
    });
    return { ok: false, error: "unexpected" };
  }
}

/** Server payload for the /films view counter band. */
export async function getViewCounterPayload() {
  const { getServiceClient } = await import("@/lib/supabase");
  const supabase = getServiceClient();
  if (!supabase) return FALLBACK;

  try {
    const site = await getSiteStats(supabase);
    await maybeRefreshYouTube(supabase, site);

    const readings = await getRecentReadings(supabase, 2);
    const youtubeViews =
      readings[0]?.view_count ?? site.youtube_views_fallback;
    const instagramViews = site.instagram_views;
    const combinedViews = youtubeViews + instagramViews;
    const viewsPerMinute = computeVelocity(readings);
    const anchorAt = readings[0]?.recorded_at
      ? new Date(readings[0].recorded_at).getTime()
      : Date.now();

    return {
      combinedViews,
      watchHours: site.watch_hours,
      anchorAt,
      viewsPerMinute,
    };
  } catch (err) {
    console.error(`${LOG_PREFIX} getViewCounterPayload failed`, {
      message: err?.message ?? String(err),
    });
    return FALLBACK;
  }
}
