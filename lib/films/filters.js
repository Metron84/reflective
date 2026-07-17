import { splitTags } from "./vocab";

export function getFilterOptions(films) {
  const tags = new Set();
  const venues = new Set();

  for (const film of films) {
    for (const club of film.clubs ?? []) {
      if (club) tags.add(club);
    }
    if (film.venue) venues.add(film.venue);
  }

  const { clubs, nations } = splitTags([...tags]);

  return {
    clubs,
    nations,
    venues: [...venues].sort((a, b) => a.localeCompare(b)),
  };
}

export function filterFilms(films, { club, nation, venue }) {
  return films.filter((film) => {
    if (club && !(film.clubs ?? []).includes(club)) return false;
    if (nation && !(film.clubs ?? []).includes(nation)) return false;
    if (venue && film.venue !== venue) return false;
    return true;
  });
}

export function sortFilmsByPublished(films) {
  return [...films].sort((a, b) =>
    String(b.published_at ?? "").localeCompare(String(a.published_at ?? ""))
  );
}

/** @deprecated Featured-first ordering; archive grid uses latest-first. */
export function partitionFeatured(films) {
  const featured = films.filter((f) => f.featured);
  const rest = films.filter((f) => !f.featured);
  return { featured, rest };
}

/** @deprecated */
export function orderGridFilms(films) {
  const { featured, rest } = partitionFeatured(films);
  return [...featured, ...rest];
}
