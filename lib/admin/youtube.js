/**
 * Parse a YouTube watch URL, short URL, Shorts URL, or bare video id.
 * Returns null if the input cannot be resolved to an id.
 */
export function parseYoutubeId(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id ?? "") ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const v = url.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      const parts = url.pathname.split("/").filter(Boolean);
      if (
        (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") &&
        parts[1] &&
        /^[a-zA-Z0-9_-]{11}$/.test(parts[1])
      ) {
        return parts[1];
      }
    }
  } catch {
    return null;
  }

  return null;
}

/** ISO 8601 duration (PT#H#M#S) → seconds, or null. */
export function parseIsoDuration(iso) {
  if (!iso || typeof iso !== "string") return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  const s = Number(m[3] || 0);
  return h * 3600 + min * 60 + s;
}

/**
 * Fetch snippet (+ contentDetails duration in the same call) for a video.
 * Never throws; returns { ok, ... } with a form-friendly error code.
 */
export async function fetchYoutubeVideoMeta(youtubeId, apiKey = process.env.YOUTUBE_API_KEY) {
  if (!youtubeId) {
    return {
      ok: false,
      code: "invalid_url",
      message: "Couldn't fetch, enter title manually.",
    };
  }
  if (!apiKey) {
    return {
      ok: false,
      code: "no_api_key",
      message: "Couldn't fetch, enter title manually.",
    };
  }

  const params = new URLSearchParams({
    part: "snippet,contentDetails",
    id: youtubeId,
    key: apiKey,
  });

  let res;
  try {
    res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params}`,
      { next: { revalidate: 0 } }
    );
  } catch {
    return {
      ok: false,
      code: "network",
      message: "Couldn't fetch, enter title manually.",
    };
  }

  if (res.status === 403 || res.status === 429) {
    return {
      ok: false,
      code: "quota",
      message: "Couldn't fetch, enter title manually.",
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      code: "api_error",
      message: "Couldn't fetch, enter title manually.",
    };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return {
      ok: false,
      code: "api_error",
      message: "Couldn't fetch, enter title manually.",
    };
  }

  const item = data?.items?.[0];
  if (!item) {
    return {
      ok: false,
      code: "not_found",
      message: "Couldn't fetch, enter title manually.",
    };
  }

  const publishedRaw = item.snippet?.publishedAt;
  const publishedAt = publishedRaw ? publishedRaw.slice(0, 10) : null;
  const durationSeconds = parseIsoDuration(item.contentDetails?.duration);

  return {
    ok: true,
    youtubeId,
    title: item.snippet?.title ?? "",
    publishedAt,
    durationSeconds,
  };
}

export function mmssToSeconds(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  const parts = raw.split(":").map((p) => p.trim());
  if (parts.length === 2) {
    const m = Number(parts[0]);
    const s = Number(parts[1]);
    if (!Number.isFinite(m) || !Number.isFinite(s) || s < 0 || s >= 60) return null;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    const s = Number(parts[2]);
    if (
      !Number.isFinite(h) ||
      !Number.isFinite(m) ||
      !Number.isFinite(s) ||
      m < 0 ||
      m >= 60 ||
      s < 0 ||
      s >= 60
    ) {
      return null;
    }
    return h * 3600 + m * 60 + s;
  }
  return null;
}

export function secondsToMmss(total) {
  const n = Math.max(0, Math.floor(Number(total) || 0));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
