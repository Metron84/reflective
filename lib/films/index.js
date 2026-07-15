import fs from "fs";
import path from "path";
import { SAMPLE_FILMS } from "@/lib/sample-films";
import { FILMS_GRID_FORMATS } from "@/lib/config";
import { displayTitle } from "@/lib/films/schema";

const FILMS_DIR = path.join(process.cwd(), "content/films");

export function normalizeFilm(raw) {
  return {
    slug: raw.slug,
    title: displayTitle(raw),
    youtube_id: raw.videoId ?? raw.youtube_id ?? raw.video_id ?? null,
    clubs: raw.clubs ?? [],
    venue: raw.venue ?? null,
    competition: raw.competition ?? null,
    format: raw.format ?? null,
    story: raw.story ?? raw.context ?? raw.context_line ?? "",
    published_at: raw.date ?? raw.published_at ?? raw.publishedAt ?? null,
    duration: raw.duration ?? null,
    featured: Boolean(raw.featured),
    embed: Boolean(raw.embed),
    needs_review: Boolean(raw.needs_review),
  };
}

export function getAllFilms() {
  if (!fs.existsSync(FILMS_DIR)) return [];

  const files = fs.readdirSync(FILMS_DIR).filter(
    (name) => name.endsWith(".json") && !name.startsWith("_")
  );
  if (files.length === 0) return [];

  return files
    .map((name) => {
      const raw = JSON.parse(fs.readFileSync(path.join(FILMS_DIR, name), "utf8"));
      return normalizeFilm(raw);
    })
    .sort((a, b) =>
      String(b.published_at ?? "").localeCompare(String(a.published_at ?? ""))
    );
}

/** Films eligible for the public grid (long-form by default). */
export function getGridFilms() {
  return getAllFilms().filter(
    (film) => film.format && FILMS_GRID_FORMATS.includes(film.format)
  );
}

export function getLatestFilms(limit = 3) {
  const grid = getGridFilms();
  if (grid.length >= limit) return grid.slice(0, limit);

  if (!fs.existsSync(FILMS_DIR)) {
    return SAMPLE_FILMS.slice(0, limit).map(normalizeFilm);
  }

  const files = fs.readdirSync(FILMS_DIR).filter(
    (name) => name.endsWith(".json") && !name.startsWith("_")
  );
  if (files.length === 0) {
    return SAMPLE_FILMS.slice(0, limit).map(normalizeFilm);
  }

  return getAllFilms().slice(0, limit);
}
