import westHam from "../../data/watch-with/west-ham.json";
import spurs from "../../data/watch-with/spurs.json";
import arsenal from "../../data/watch-with/arsenal.json";
import liverpool from "../../data/watch-with/liverpool.json";
import astonVilla from "../../data/watch-with/aston-villa.json";
import rangers from "../../data/watch-with/rangers.json";

const CLUBS = [westHam, spurs, arsenal, liverpool, astonVilla, rangers].sort(
  (a, b) => a.sortOrder - b.sortOrder,
);

export function getClub(slug) {
  return CLUBS.find((club) => club.slug === slug) ?? null;
}

export function listClubs() {
  return CLUBS;
}

export function cardById(club, id) {
  return club?.cards?.find((card) => card.id === id) ?? null;
}

export function publicCard(card) {
  if (!card) return null;
  return {
    id: card.id,
    name: card.name,
    category: card.category,
    tagline: card.tagline,
  };
}
