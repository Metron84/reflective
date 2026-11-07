/**
 * Locked archetype signatures and three-sentence readings (panel voice).
 * Match by squared Euclidean distance to the user vector.
 */

export const ARCHETYPES = [
  {
    name: "The Romantic Traditionalist",
    lean: "High Heritage, Journey, Meaning",
    vector: [6, 6, 4, 7, 5, 5, 5, 6, 6, 7, 4, 7],
    reading:
      "You stay for the songs and the years that came before you. The club is a place that should still feel like itself. Change is tolerated only when it does not erase the ritual.",
  },
  {
    name: "The Relentless Achiever",
    lean: "High Success, Results, Establishment",
    vector: [1, 3, 2, 1, 2, 3, 3, 4, 3, 4, 1, 4],
    reading:
      "You follow to see the standard met. Winning is the language the club is supposed to speak. Style matters when it serves the result.",
  },
  {
    name: "The Faithful Sufferer",
    lean: "High Suffering, Journey, Local",
    vector: [7, 6, 4, 7, 3, 3, 4, 3, 7, 6, 4, 6],
    reading:
      "You already know the bad years are part of the agreement. Loyalty is proved by staying when the results are poor. The city and the ritual are enough.",
  },
  {
    name: "The Tactical Idealist",
    lean: "High Aesthetics, Ideology, Control",
    vector: [3, 4, 4, 4, 7, 2, 6, 7, 4, 5, 4, 5],
    reading:
      "You want a recognisable idea on the pitch that lasts longer than one manager. Results are accepted; betrayal of the idea is not.",
  },
  {
    name: "The Community Guardian",
    lean: "High Local, Belonging, Meaning",
    vector: [5, 4, 2, 6, 4, 4, 6, 5, 7, 6, 5, 7],
    reading:
      "The club belongs to the place and the people who keep it. Global noise is secondary. You notice who is welcomed and who is left outside.",
  },
  {
    name: "The Rebel Supporter",
    lean: "High Defiance, Distinction, Volatile",
    vector: [6, 7, 7, 6, 4, 5, 5, 4, 7, 5, 7, 7],
    reading:
      "You are most at home when the club stands against something. Being understood by everyone would feel like dilution. Conflict is not a flaw.",
  },
  {
    name: "The Academy Evangelist",
    lean: "High Development, Ideology, Journey",
    vector: [4, 5, 4, 6, 6, 5, 7, 7, 5, 5, 4, 5],
    reading:
      "You trust what the club grows more than what it buys. The long work of the academy is part of the identity. Instant success that skips that work feels thin.",
  },
  {
    name: "The Global Dreamer",
    lean: "High Global, Success, Entertainment",
    vector: [2, 5, 1, 3, 5, 5, 4, 4, 1, 3, 3, 2],
    reading:
      "You want the club to belong to more than one city. Scale and spectacle are not corruptions; they are the point of the modern game.",
  },
  {
    name: "The Matchday Pilgrim",
    lean: "High Journey, Heritage, Meaning",
    vector: [6, 6, 5, 7, 5, 5, 5, 4, 6, 7, 5, 7],
    reading:
      "You treat the match as ritual rather than consumption. History, travel and atmosphere matter even in poor seasons. Trophies are welcome; they are not required.",
  },
  {
    name: "The Ambitious Builder",
    lean: "High Success, Acquisition, Modernity",
    vector: [2, 4, 4, 3, 5, 5, 2, 5, 4, 2, 3, 4],
    reading:
      "You want the club to gather what it needs and move forward. Standing still out of sentiment is not a virtue. The next version of the club should be stronger.",
  },
  {
    name: "The Cult Club Seeker",
    lean: "High Distinction, Defiance, Ideology",
    vector: [6, 5, 7, 6, 5, 5, 5, 6, 7, 5, 7, 6],
    reading:
      "You prefer a club few people fully understand. Shared knowledge with everyone around you is not the goal. The narrower the circle, the clearer the identity.",
  },
  {
    name: "The Standard Bearer",
    lean: "High Establishment, Results, Calm",
    vector: [2, 2, 2, 2, 2, 3, 4, 5, 4, 6, 1, 5],
    reading:
      "You expect the club to carry a certain weight and to do things properly. Chaos and outsider romance are less interesting than sustained competence.",
  },
];

/**
 * @param {number[]} userVector
 * @returns {{ name: string; reading: string; lean: string }}
 */
export function nearestArchetype(userVector) {
  let best = ARCHETYPES[0];
  let bestDist = Infinity;
  for (const archetype of ARCHETYPES) {
    let dist = 0;
    for (let i = 0; i < 12; i++) {
      dist += (userVector[i] - archetype.vector[i]) ** 2;
    }
    if (dist < bestDist) {
      bestDist = dist;
      best = archetype;
    }
  }
  return { name: best.name, reading: best.reading, lean: best.lean };
}
