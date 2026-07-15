/** Films catalog JSON shape (content/films/[slug].json). Redirect-first v1. */

export const FILM_FORMATS = [
  "catchmentary",
  "podcast",
  "short_film",
  "explainer",
  "compilation",
  "promo",
];

/** Sync never writes these keys on an existing entry. */
export const PROTECTED_FILM_FIELDS = [
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

export const SAMPLE_STORY =
  "SAMPLE: Editorial line pending. Replace before publish.";

export function displayTitle(film) {
  if (film.titleOverride?.trim()) return film.titleOverride.trim();
  return film.title ?? "";
}

export function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
