import fs from "fs";
import path from "path";
import { getAllFilms } from "@/lib/films/index";
import { youtubeWatchUrl } from "@/lib/films/schema";

export const STATUS = {
  films: {
    enabled: true,
    line: "From the fans, every day.",
  },
  awards: {
    enabled: true,
    line: "Voting is live. Eight categories, your call.",
  },
  games: {
    enabled: true,
    line: "New. Codemaster: 677 codes, 39 chapters.",
  },
  concierge: {
    enabled: true,
    line:
      "Your way in. Ask about a film, a bar, or a fan group in Dubai.",
  },
  archive: {
    enabled: true,
    line: "Football in books, film, photography, music and art.",
  },
};

/** Melo curates this list. Empty → STATUS.films.line + href /films. */
export const FILM_OF_THE_DAY_POOL = [
  { youtubeId: "RyvKEf5OFdk", title: "They Invited Us Home" },
  { youtubeId: "1JebGnBDdp4", title: "Ro or Die" },
  { youtubeId: "BYWHkaAPWOo", title: "Spain in Dubai" },
  { youtubeId: "vqDfM_M6HQw", title: "Belgium's Twelfth Player" },
  { youtubeId: "lrRfE5PHSZI", title: "The Signs Were There" },
  { youtubeId: "UwLYUJRIYMc", title: "The Belgian Wall" },
];

const FILM_SLUG_PAGE_CANDIDATES = [
  "app/films/[slug]/page.js",
  "app/films/[slug]/page.jsx",
  "app/films/[slug]/page.tsx",
];

function hasFilmSlugRoute() {
  return FILM_SLUG_PAGE_CANDIDATES.some((rel) =>
    fs.existsSync(path.join(process.cwd(), rel))
  );
}

/** True when entries.json has at least one published archive entry. */
function hasPublishedArchiveEntries() {
  const file = path.join(process.cwd(), "content/archive/entries.json");
  if (!fs.existsSync(file)) return false;
  try {
    const entries = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(entries) && entries.length > 0;
  } catch {
    return false;
  }
}

/** Calendar days since Unix epoch in Asia/Dubai (turns over at midnight GST). */
export function gstDaysSinceEpoch(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, d] = day.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function pickFilmOfTheDay(now = new Date()) {
  const pool = FILM_OF_THE_DAY_POOL;
  if (!pool.length) return null;
  const index = gstDaysSinceEpoch(now) % pool.length;
  return pool[index];
}

function resolveFilmHref(film) {
  if (film.youtubeId) {
    return youtubeWatchUrl(film.youtubeId);
  }

  if (hasFilmSlugRoute() && film.slug) {
    return `/films/${film.slug}`;
  }

  if (film.slug) {
    const catalog = getAllFilms().find((entry) => entry.slug === film.slug);
    if (catalog?.youtube_id) {
      return youtubeWatchUrl(catalog.youtube_id);
    }
  }

  return null;
}

/**
 * Server-only. Per-door status line + href for the homepage doors menu.
 * When a specific film is named, never falls back to /films.
 * Empty title → fallback line, never a blank "Today's film:".
 */
export function getHomepageDoorMeta(now = new Date()) {
  const film = pickFilmOfTheDay(now);
  let filmsStatusLine = null;
  let filmsHref = "/films";

  if (STATUS.films.enabled) {
    if (film) {
      const href = resolveFilmHref(film);
      const title = typeof film.title === "string" ? film.title.trim() : "";
      if (href && title) {
        filmsStatusLine = `Today's film: ${title}`;
        filmsHref = href;
      } else {
        filmsStatusLine = STATUS.films.line;
        filmsHref = "/films";
      }
    } else {
      filmsStatusLine = STATUS.films.line;
      filmsHref = "/films";
    }
  }

  const archivePublished = hasPublishedArchiveEntries();
  const archiveEnabled = STATUS.archive.enabled && archivePublished;

  return {
    films: {
      statusLine: filmsStatusLine,
      href: filmsHref,
      external: Boolean(filmsHref?.startsWith("http")),
    },
    awards: {
      statusLine: STATUS.awards.enabled ? STATUS.awards.line : null,
      href: "/reflections",
      external: false,
    },
    games: {
      statusLine: STATUS.games.enabled ? STATUS.games.line : null,
      href: "/games",
      external: false,
    },
    concierge: {
      statusLine: STATUS.concierge.enabled ? STATUS.concierge.line : null,
      href: "/concierge",
      external: false,
    },
    archive: {
      statusLine: archiveEnabled ? STATUS.archive.line : null,
      href: "/archive",
      external: false,
      visible: archiveEnabled,
    },
  };
}
