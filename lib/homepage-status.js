import fs from "fs";
import path from "path";
import { getAllFilms } from "@/lib/films/index";
import { youtubeWatchUrl } from "@/lib/films/schema";
import { ULTIMA_ENABLED } from "@/lib/config";
import { DOORS as HOME_DOORS } from "@/lib/home";

const GAMES_DOOR_LINE_DEFAULT = "New. Codemaster: 677 codes, 39 chapters.";
const GAMES_DOOR_LINE_ULTIMA =
  "Ultima. Draft Europe's top five. Thirty players. Invite only.";

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
    line: GAMES_DOOR_LINE_DEFAULT,
  },
  concierge: {
    enabled: true,
    line:
      "Your way in. Ask about a film, a bar, or a fan group in Dubai.",
  },
  archive: {
    enabled: true,
    line: "190+ works. Where to start with each.",
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
 * Films: label always goes to /films. Film-of-the-day watch URL is statusHref only.
 * Empty title → fallback line as plain text, never a dead /films status link.
 */
export function getHomepageDoorMeta(now = new Date()) {
  const film = pickFilmOfTheDay(now);
  let filmsStatusLine = null;
  let filmsStatusHref = null;

  if (STATUS.films.enabled) {
    if (film) {
      const watchHref = resolveFilmHref(film);
      const title = typeof film.title === "string" ? film.title.trim() : "";
      if (watchHref && title) {
        filmsStatusLine = `Today: ${title}`;
        filmsStatusHref = watchHref;
      } else {
        filmsStatusLine = STATUS.films.line;
      }
    } else {
      filmsStatusLine = STATUS.films.line;
    }
  }

  const archivePublished = hasPublishedArchiveEntries();
  const archiveEnabled = STATUS.archive.enabled && archivePublished;

  return {
    films: {
      statusLine: filmsStatusLine,
      statusHref: filmsStatusHref,
      href: "/films",
      external: false,
    },
    awards: {
      statusLine: STATUS.awards.enabled ? STATUS.awards.line : null,
      href: "/reflections",
      external: false,
    },
    games: {
      statusLine: STATUS.games.enabled
        ? ULTIMA_ENABLED
          ? GAMES_DOOR_LINE_ULTIMA
          : GAMES_DOOR_LINE_DEFAULT
        : null,
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

function publicFileExists(src) {
  if (typeof src !== "string" || !src.startsWith("/")) return false;
  const root = path.join(process.cwd(), "public");
  const file = path.join(root, src);
  if (!file.startsWith(root + path.sep)) return false;
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * Server-only. One image per homepage door, rotating at midnight GST.
 * Only files that exist in /public are eligible; with none, image is null and
 * the tile renders as navy with a grain overlay.
 */
export function getHomeDoors(now = new Date()) {
  const day = gstDaysSinceEpoch(now);
  return HOME_DOORS.map((door) => {
    const pool = door.images.filter((image) => publicFileExists(image.src));
    return {
      key: door.key,
      label: door.label,
      href: door.href,
      status: door.status,
      live: door.live,
      image: pool.length ? pool[day % pool.length] : null,
    };
  });
}

/** Server-only. Hero image src, or null when the file is missing. */
export function getHomeHeroSrc() {
  const src = "/home/hero.jpg";
  return publicFileExists(src) ? src : null;
}

/** Server-only. Badge image srcs found in /public/home/badges/. */
export function getHomeBadges() {
  const dir = path.join(process.cwd(), "public/home/badges");
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => /\.(svg|png|webp|jpe?g)$/i.test(name))
      .sort()
      .map((name) => `/home/badges/${name}`);
  } catch {
    return [];
  }
}
