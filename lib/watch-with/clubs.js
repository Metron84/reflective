import westHam from "../../data/watch-with/west-ham.json";

const CLUBS = {
  [westHam.slug]: westHam,
};

export function getClub(slug) {
  return CLUBS[slug] ?? null;
}

export function listClubs() {
  return Object.values(CLUBS);
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
