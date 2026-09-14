export const ARCHETYPES = [
  {
    name: "The Romantic Traditionalist",
    vector: [6, 6, 4, 6, 6, 5, 5, 6, 6, 7, 4, 6],
    reading:
      "You want football that was inherited, not bought. Songs, scars and a club that keeps faith with its own past.",
  },
  {
    name: "The Relentless Achiever",
    vector: [1, 3, 2, 1, 4, 3, 3, 4, 3, 4, 2, 4],
    reading:
      "You have no romance about losing. You want standards, expectation and a club that treats winning as the baseline.",
  },
  {
    name: "The Faithful Sufferer",
    vector: [7, 6, 4, 6, 3, 3, 4, 3, 6, 6, 4, 6],
    reading:
      "You measure loyalty in bad seasons. A club that is easy to support would mean nothing to you.",
  },
  {
    name: "The Tactical Idealist",
    vector: [3, 4, 4, 4, 7, 6, 6, 7, 4, 5, 4, 5],
    reading:
      "You follow ideas before results. You want a club with an argument about how football should be played.",
  },
  {
    name: "The Community Guardian",
    vector: [5, 4, 5, 6, 4, 4, 6, 5, 7, 6, 5, 7],
    reading:
      "A club belongs to the place that made it. You want yours to mean something to the street outside the ground.",
  },
  {
    name: "The Rebel Supporter",
    vector: [6, 6, 7, 6, 4, 5, 5, 4, 7, 5, 7, 7],
    reading:
      "You are drawn to clubs that stand against something. The badge is a position, not a purchase.",
  },
  {
    name: "The Academy Evangelist",
    vector: [4, 5, 4, 5, 6, 5, 7, 6, 5, 5, 4, 5],
    reading:
      "You want to watch someone grow up in the shirt. Bought success feels borrowed to you.",
  },
  {
    name: "The Global Dreamer",
    vector: [3, 5, 1, 3, 6, 5, 4, 4, 2, 4, 3, 4],
    reading:
      "Football is a world game and you want a club that lives at that scale, followed everywhere at once.",
  },
  {
    name: "The Matchday Pilgrim",
    vector: [6, 6, 5, 7, 5, 5, 5, 4, 6, 6, 5, 7],
    reading:
      "You treat football as ritual rather than consumption. The journey is the thing you would keep.",
  },
  {
    name: "The Ambitious Builder",
    vector: [3, 4, 4, 3, 5, 5, 5, 6, 4, 3, 3, 4],
    reading:
      "You want a club going somewhere, with a plan you can see, and the nerve to back it.",
  },
  {
    name: "The Cult Club Seeker",
    vector: [6, 5, 7, 6, 5, 5, 5, 4, 7, 5, 6, 6],
    reading:
      "You want a club nobody around you has picked. Being hard to explain is part of the appeal.",
  },
  {
    name: "The Standard Bearer",
    vector: [2, 3, 2, 2, 4, 3, 4, 5, 4, 6, 1, 5],
    reading:
      "You are drawn to institutions: power, history and the expectation that comes with both.",
  },
];

/**
 * @param {number[]} userVector
 * @returns {{ name: string; reading: string }}
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
  return { name: best.name, reading: best.reading };
}
