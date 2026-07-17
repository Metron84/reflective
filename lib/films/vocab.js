import filmsVocab from "../../content/films/_vocab.json";

const clubSet = new Set(filmsVocab.clubs ?? []);
const nationSet = new Set(filmsVocab.nations ?? []);

export function splitTags(tags) {
  const clubs = [];
  const nations = [];

  for (const tag of tags) {
    if (nationSet.has(tag)) {
      nations.push(tag);
    } else {
      clubs.push(tag);
    }
  }

  return {
    clubs: clubs.sort((a, b) => a.localeCompare(b)),
    nations: nations.sort((a, b) => a.localeCompare(b)),
  };
}

export function getFilmsVocab() {
  return { clubs: clubSet, nations: nationSet };
}
