/**
 * Crest facet poles. Scale is -1 for the left pole, +1 for the right pole.
 * Extracted from docs/crest-road-prototype.html (`F`, `FN`, `PH`).
 */

/**
 * @typedef {Object} CrestFacet
 * @property {string} key
 * @property {string} group
 * @property {string} left
 * @property {string} right
 * @property {string} label
 * @property {[string, string]} phrases
 */

/** @type {CrestFacet[]} */
export const FACETS = [
  {
    key: "winning-vs-enduring",
    group: "Heart",
    left: "Winning",
    right: "Enduring",
    label: "winning vs enduring",
    phrases: ["all about winning", "in it for the long haul"],
  },
  {
    key: "emotional-climate",
    group: "Heart",
    left: "Calm",
    right: "Intense",
    label: "emotional climate",
    phrases: ["calm under pressure", "wildly intense"],
  },
  {
    key: "openness",
    group: "Heart",
    left: "Tight-knit",
    right: "Open",
    label: "openness",
    phrases: ["tight-knit", "open to everyone"],
  },
  {
    key: "what-gives-meaning",
    group: "Heart",
    left: "Belonging",
    right: "Glory",
    label: "what gives meaning",
    phrases: ["about belonging", "chasing glory"],
  },
  {
    key: "style",
    group: "Mind",
    left: "Beautiful",
    right: "Effective",
    label: "style",
    phrases: ["into beautiful football", "all about results"],
  },
  {
    key: "risk",
    group: "Mind",
    left: "Planned",
    right: "Gamble",
    label: "risk",
    phrases: ["a planner", "a gambler"],
  },
  {
    key: "talent",
    group: "Mind",
    left: "Homegrown",
    right: "Bought",
    label: "talent",
    phrases: ["into homegrown talent", "happy to buy the best"],
  },
  {
    key: "philosophy",
    group: "Mind",
    left: "Head",
    right: "Heart",
    label: "philosophy",
    phrases: ["head over heart", "heart over head"],
  },
  {
    key: "reach",
    group: "Soul",
    left: "Rooted",
    right: "Global",
    label: "reach",
    phrases: ["rooted in one place", "made for the world"],
  },
  {
    key: "time",
    group: "Soul",
    left: "Tradition",
    right: "Modern",
    label: "time",
    phrases: ["old school", "into the new"],
  },
  {
    key: "power",
    group: "Soul",
    left: "Local hands",
    right: "Big capital",
    label: "power",
    phrases: ["happy in local hands", "fine with big money"],
  },
  {
    key: "purpose",
    group: "Soul",
    left: "Stand for something",
    right: "Win",
    label: "purpose",
    phrases: ["here to stand for something", "here to win"],
  },
];
