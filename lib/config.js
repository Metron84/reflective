// Central site configuration. Data changes happen here, never in components.

export const REFLECTIONS_VISIBLE_BODY_COUNT = 5;

export const REFLECTIONS_CATEGORIES = [
  { slug: "best-celebration", name: "Best Celebration", open: true, sort_order: 1 },
  { slug: "best-video", name: "Best Video", open: false, sort_order: 2 },
  {
    slug: "best-supporters-club",
    name: "Best Supporters Club",
    open: false,
    sort_order: 3,
  },
  { slug: "best-supporter", name: "Best Supporter", open: false, sort_order: 4 },
  { slug: "best-soundbite", name: "Best Soundbite", open: false, sort_order: 5 },
  { slug: "best-heartbreak", name: "Best Heartbreak", open: false, sort_order: 6 },
  { slug: "best-chant", name: "Best Chant", open: false, sort_order: 7 },
  {
    slug: "best-matchday-night",
    name: "Best Matchday Night",
    open: false,
    sort_order: 8,
  },
];

export const GUESSER_STRAPLINE = "Wordle for football.";

export function getCategoriesBySortOrder() {
  return [...REFLECTIONS_CATEGORIES].sort(
    (a, b) => a.sort_order - b.sort_order
  );
}

/** All eight categories for sticky jump-nav. */
export function getReflectionsNavCategories() {
  return getCategoriesBySortOrder();
}

/** Top N categories rendered in the page body (currently five). */
export function getReflectionsBodyCategories(
  count = REFLECTIONS_VISIBLE_BODY_COUNT
) {
  return getCategoriesBySortOrder().slice(0, count);
}

export const REFLECTIONS_VOTING = {
  // Voting opens at site launch; already open for development.
  opensAt: "2026-07-13T00:00:00+04:00",
  closesAt: "2026-08-31T23:59:59+04:00",
  winnersAnnounced: "2026-09-01",
};

export function getOpenCategories() {
  return REFLECTIONS_CATEGORIES.filter((c) => c.open);
}

export function getOpenCategorySlugs() {
  return getOpenCategories().map((c) => c.slug);
}

export function isCategoryOpen(slug) {
  return REFLECTIONS_CATEGORIES.some((c) => c.slug === slug && c.open);
}

// Drop a real footage frame into public/stills/ and set its path here.
// null renders the navy-to-black gradient placeholder.
export const REFLECTIONS_HERO_STILL = null;

// Home page hero background. Same pattern as Reflections hero.
export const HOME_HERO_STILL = null;

export function getVotingState(now = new Date()) {
  const opens = new Date(REFLECTIONS_VOTING.opensAt);
  const closes = new Date(REFLECTIONS_VOTING.closesAt);
  if (now < opens) return "before";
  if (now > closes) return "closed";
  return "open";
}

const GST = "Asia/Dubai";

/** Days until voting closes. Same source as /reflections countdown. */
export function reflectionsDaysLeft(now = Date.now()) {
  const ms = new Date(REFLECTIONS_VOTING.closesAt).getTime() - now;
  return Math.max(0, Math.ceil(ms / 86400000));
}

/** e.g. "Voting closes 23 August at 23:59 GST" from closesAt. */
export function reflectionsCloseSummary() {
  const closes = new Date(REFLECTIONS_VOTING.closesAt);
  const day = closes.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: GST,
  });
  const time = closes.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: GST,
  });
  return `Voting closes ${day} at ${time} GST`;
}

/** Hero and door copy: winners date only (close enforced server-side). */
export function reflectionsWinnersHeroLine() {
  const d = new Date(`${REFLECTIONS_VOTING.winnersAnnounced}T12:00:00+04:00`);
  const month = d.toLocaleDateString("en-GB", { month: "long", timeZone: GST });
  const dayNum = Number(
    d.toLocaleDateString("en-GB", { day: "numeric", timeZone: GST })
  );
  const suffix =
    dayNum === 1 || dayNum === 21 || dayNum === 31
      ? "st"
      : dayNum === 2 || dayNum === 22
        ? "nd"
        : dayNum === 3 || dayNum === 23
          ? "rd"
          : "th";
  return `Winners announced ${month} ${dayNum}${suffix}.`;
}

/** e.g. "1 September" from winnersAnnounced. */
export function reflectionsWinnersDay() {
  const d = new Date(`${REFLECTIONS_VOTING.winnersAnnounced}T12:00:00+04:00`);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: GST,
  });
}

// Home page band order. null = auto from winnersAnnounced date.
// Set to "voting" or "results" to override for previews.
export const HOME_SECTION_LAYOUT = null;

export const HOME_SECTION_ORDERS = {
  voting: ["reflections", "guesser", "films", "stats", "newsletter"],
  results: ["films", "guesser", "reflections", "stats", "newsletter"],
};

/** "results" from winnersAnnounced day (September 1). */
export function getHomeSectionLayout(now = new Date()) {
  if (HOME_SECTION_LAYOUT === "voting" || HOME_SECTION_LAYOUT === "results") {
    return HOME_SECTION_LAYOUT;
  }
  const resultsStart = new Date(
    `${REFLECTIONS_VOTING.winnersAnnounced}T00:00:00+04:00`
  );
  return now >= resultsStart ? "results" : "voting";
}

export function getHomeSectionOrder(now = new Date()) {
  return HOME_SECTION_ORDERS[getHomeSectionLayout(now)];
}

/** Formats shown on /films grid (long-form + Shorts). Promo stays off-grid. */
export const FILMS_GRID_FORMATS = [
  "catchmentary",
  "podcast",
  "explainer",
  "compilation",
  "short_film",
];
