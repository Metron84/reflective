#!/usr/bin/env node
/**
 * Sync TRF film catalog from @TheReflectiveFootball uploads.
 * Usage: node scripts/sync-films.mjs
 * Requires YOUTUBE_API_KEY (and optional YOUTUBE_CHANNEL_HANDLE) in .env.local or env.
 *
 * Idempotent. Slugs stay fixed once written. Hand-edited fields are never overwritten.
 */

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FILMS_DIR = path.join(ROOT, "content/films");

const PROTECTED_FILM_FIELDS = [
  "slug",
  "titleOverride",
  "clubs",
  "venue",
  "competition",
  "format",
  "story",
  "featured",
  "embed",
];

const SAMPLE_STORY =
  "SAMPLE: Editorial line pending. Replace before publish.";

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}

function slugify(text) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

async function ytFetch(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function resolveChannelId(apiKey, handle) {
  const clean = handle.replace(/^@/, "");
  const byHandle = new URLSearchParams({
    part: "id,contentDetails",
    forHandle: clean,
    key: apiKey,
  });
  let data = await ytFetch(
    `https://www.googleapis.com/youtube/v3/channels?${byHandle}`
  );
  if (data.items?.[0]?.id) return data.items[0];

  const bySearch = new URLSearchParams({
    part: "snippet",
    q: clean,
    type: "channel",
    maxResults: "1",
    key: apiKey,
  });
  data = await ytFetch(
    `https://www.googleapis.com/youtube/v3/search?${bySearch}`
  );
  const channelId = data.items?.[0]?.snippet?.channelId;
  if (!channelId) throw new Error(`Channel not found for handle: ${handle}`);

  const full = new URLSearchParams({
    part: "id,contentDetails",
    id: channelId,
    key: apiKey,
  });
  data = await ytFetch(
    `https://www.googleapis.com/youtube/v3/channels?${full}`
  );
  return data.items?.[0] ?? null;
}

async function fetchAllUploadVideoIds(apiKey, uploadsPlaylistId) {
  const ids = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      part: "contentDetails,snippet",
      playlistId: uploadsPlaylistId,
      maxResults: "50",
      key: apiKey,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await ytFetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`
    );
    for (const item of data.items ?? []) {
      const id = item.contentDetails?.videoId;
      if (id) ids.push(id);
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return ids;
}

async function fetchVideoDetails(apiKey, videoIds) {
  const map = new Map();
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      id: chunk.join(","),
      key: apiKey,
    });
    const data = await ytFetch(
      `https://www.googleapis.com/youtube/v3/videos?${params}`
    );
    for (const item of data.items ?? []) {
      map.set(item.id, item);
    }
  }
  return map;
}

function loadExistingFilms() {
  if (!existsSync(FILMS_DIR)) return { byVideoId: new Map(), bySlug: new Set() };

  const byVideoId = new Map();
  const bySlug = new Set();

  for (const name of readdirSync(FILMS_DIR).filter((n) => n.endsWith(".json"))) {
    const filePath = path.join(FILMS_DIR, name);
    const film = JSON.parse(readFileSync(filePath, "utf8"));
    if (film.videoId) byVideoId.set(film.videoId, { film, filePath, fileName: name });
    if (film.slug) bySlug.add(film.slug);
  }
  return { byVideoId, bySlug };
}

function allocateSlug(baseTitle, videoId, usedSlugs) {
  let base = slugify(baseTitle);
  if (!base) base = `film-${videoId.slice(0, 8)}`;
  let slug = base;
  let n = 2;
  while (usedSlugs.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  usedSlugs.add(slug);
  return slug;
}

function taxonomyComplete(film) {
  return Boolean(
    film.format &&
      (film.clubs?.length > 0 || film.venue || film.competition)
  );
}

function buildNewFilm({ videoId, title, date, duration, slug }) {
  return {
    videoId,
    title,
    titleOverride: null,
    slug,
    clubs: [],
    venue: null,
    competition: null,
    format: null,
    story: SAMPLE_STORY,
    date,
    duration,
    featured: false,
    embed: false,
    needs_review: true,
  };
}

function mergeFilm(existing, apiFields) {
  const merged = { ...existing, ...apiFields };
  for (const key of PROTECTED_FILM_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(existing, key)) {
      merged[key] = existing[key];
    }
  }
  if (existing.titleOverride?.trim()) {
    merged.titleOverride = existing.titleOverride;
  } else {
    merged.title = apiFields.title;
  }
  if (existing.needs_review === false) {
    merged.needs_review = false;
  } else {
    merged.needs_review = !taxonomyComplete(merged);
  }
  return merged;
}

function writeFilm(slug, film) {
  const filePath = path.join(FILMS_DIR, `${slug}.json`);
  writeFileSync(filePath, `${JSON.stringify(film, null, 2)}\n`, "utf8");
  return filePath;
}

function removeStaleFileIfRenamed(oldEntry, newSlug) {
  const expectedName = `${newSlug}.json`;
  if (oldEntry.fileName !== expectedName && existsSync(oldEntry.filePath)) {
    // Slug is immutable; file name should always match slug.
  }
}

async function main() {
  loadEnvLocal();

  const apiKey = process.env.YOUTUBE_API_KEY;
  const handle = process.env.YOUTUBE_CHANNEL_HANDLE ?? "TheReflectiveFootball";

  if (!apiKey) {
    console.error("Set YOUTUBE_API_KEY in .env.local or the environment.");
    process.exit(1);
  }

  mkdirSync(FILMS_DIR, { recursive: true });

  console.log(`Resolving channel @${handle.replace(/^@/, "")}…`);
  const channel = await resolveChannelId(apiKey, handle);
  if (!channel?.id) {
    console.error("Could not resolve channel.");
    process.exit(1);
  }

  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    console.error("No uploads playlist on channel.");
    process.exit(1);
  }

  console.log(`Channel ID: ${channel.id}`);
  console.log("Fetching uploads…");

  const videoIds = await fetchAllUploadVideoIds(apiKey, uploadsPlaylistId);
  const details = await fetchVideoDetails(apiKey, videoIds);
  const { byVideoId, bySlug } = loadExistingFilms();

  let created = 0;
  let updated = 0;
  const catalog = [];

  for (const videoId of videoIds) {
    const item = details.get(videoId);
    if (!item) continue;

    const apiTitle = item.snippet?.title ?? "Untitled";
    const date = (item.snippet?.publishedAt ?? "").slice(0, 10) || null;
    const duration = item.contentDetails?.duration ?? null;
    const apiFields = { videoId, title: apiTitle, date, duration };

    const existing = byVideoId.get(videoId);

    if (existing) {
      const merged = mergeFilm(existing.film, apiFields);
      removeStaleFileIfRenamed(existing, merged.slug);
      writeFilm(merged.slug, merged);
      updated += 1;
      catalog.push({
        videoId,
        title: merged.titleOverride?.trim() || merged.title,
        slug: merged.slug,
        needs_review: merged.needs_review,
        status: "updated",
      });
    } else {
      const slug = allocateSlug(apiTitle, videoId, bySlug);
      const film = buildNewFilm({ ...apiFields, slug });
      writeFilm(slug, film);
      byVideoId.set(videoId, { film, filePath: path.join(FILMS_DIR, `${slug}.json`) });
      created += 1;
      catalog.push({
        videoId,
        title: film.title,
        slug: film.slug,
        needs_review: true,
        status: "created",
      });
    }
  }

  catalog.sort((a, b) => a.title.localeCompare(b.title));

  console.log("");
  console.log(`Synced ${catalog.length} films (${created} new, ${updated} updated).`);
  console.log(`${catalog.filter((c) => c.needs_review).length} flagged needs_review.`);
  console.log("");
  console.log("Catalog (title · videoId):");
  console.log("—".repeat(60));
  for (const row of catalog) {
    const flag = row.needs_review ? " [needs_review]" : "";
    console.log(`${row.videoId}  ${row.title}${flag}`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
