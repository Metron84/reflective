export function getFilterOptions(films) {
  const clubs = new Set();
  const venues = new Set();

  for (const film of films) {
    for (const club of film.clubs ?? []) {
      if (club) clubs.add(club);
    }
    if (film.venue) venues.add(film.venue);
  }

  return {
    clubs: [...clubs].sort((a, b) => a.localeCompare(b)),
    venues: [...venues].sort((a, b) => a.localeCompare(b)),
  };
}

export function filterFilms(films, { club, venue }) {
  return films.filter((film) => {
    if (club && !(film.clubs ?? []).includes(club)) return false;
    if (venue && film.venue !== venue) return false;
    return true;
  });
}

export function partitionFeatured(films) {
  const featured = films.filter((f) => f.featured);
  const rest = films.filter((f) => !f.featured);
  return { featured, rest };
}

export function orderGridFilms(films) {
  const { featured, rest } = partitionFeatured(films);
  return [...featured, ...rest];
}
