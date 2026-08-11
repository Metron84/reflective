// Central site configuration. Data changes happen here, never in components.

export const SITE_URL = "https://thereflectivefootball.com";

/** Hero promo mp4. Prefer Vercel Blob URL in env; local path for dev. */
export const HERO_PROMO_VIDEO_FALLBACK = "/promo/promo.mp4";

export function getHeroPromoVideoSrc() {
  const fromEnv = process.env.HERO_PROMO_VIDEO_URL?.trim();
  return fromEnv || HERO_PROMO_VIDEO_FALLBACK;
}

export const SITE_DESCRIPTION =
  "The Reflective Football is a fan-first football documentary network. We connect the football fan community. Football is nothing without the fans.";

export const SOCIAL_LINKS = {
  youtube: "https://www.youtube.com/@TheReflectiveFootball",
  instagram: "https://www.instagram.com/thereflectivefootball",
  linkedin: "https://www.linkedin.com/company/the-reflective-football/",
};

export const REFLECTIONS_CATEGORIES = [
  {
    slug: "best-video",
    name: "Best Video",
    open: true,
    sort_order: 1,
    category_youtube_id: "h4dTMLEXzhw",
    cardVariant: "title",
  },
  {
    slug: "best-supporters-club",
    name: "Best Supporters Club",
    open: true,
    sort_order: 2,
    category_youtube_id: "k1b1m6vVQwo",
    cardVariant: "flag",
  },
  {
    slug: "best-celebration",
    name: "Best Celebration",
    open: true,
    sort_order: 3,
    category_youtube_id: "iZqUA_V0HnM",
    cardVariant: "flag",
  },
  {
    slug: "best-chant",
    name: "Best Chant",
    open: true,
    sort_order: 4,
    category_youtube_id: "_ZShgaFPZOg",
    cardVariant: "flag",
  },
  {
    slug: "best-supporter",
    name: "Supporter of the Year",
    open: true,
    sort_order: 5,
    category_youtube_id: "H6rhtaK4FJE",
    cardVariant: "flag",
  },
  {
    slug: "best-message",
    name: "Best Message from the Fans",
    open: true,
    sort_order: 6,
    category_youtube_id: "UX56p4YAIR4",
    category_poster: "/reflections/best-message.jpg",
    cardVariant: "quote",
    showQuoteMarks: true,
  },
  {
    slug: "best-interview",
    name: "Best Interview",
    open: true,
    sort_order: 7,
    category_youtube_id: "9KE_DfepN3w",
    category_poster: "/reflections/best-interview.jpg",
    cardVariant: "quote",
    showQuoteMarks: false,
  },
  {
    slug: "best-soundbite",
    name: "Best Soundbite",
    open: true,
    sort_order: 8,
    category_youtube_id: "uwauSqa1Qzs",
    category_poster: "/reflections/best-soundbite.jpg",
    cardVariant: "quote",
    showQuoteMarks: true,
  },
];

export const GUESSER_STRAPLINE = "Wordle for football.";

/** The Stand public surface. Flip true to restore /games card, sitemap, and indexable /stand. */
export const STAND_ENABLED = false;

/** LaLiga Nights: homepage ribbon, indexable /laliga, sitemap. Flip false when the campaign ends. */
export const LALIGA_CAMPAIGN_ENABLED = true;

export function getCategoriesBySortOrder() {
  return [...REFLECTIONS_CATEGORIES].sort(
    (a, b) => a.sort_order - b.sort_order
  );
}

/** Open categories for sticky nav and page body on /reflections. */
export function getReflectionsLiveCategories() {
  return getCategoriesBySortOrder().filter((c) => c.open);
}

/** @deprecated Use getReflectionsLiveCategories */
export function getReflectionsNavCategories() {
  return getReflectionsLiveCategories();
}

/** @deprecated Use getReflectionsLiveCategories */
export function getReflectionsBodyCategories() {
  return getReflectionsLiveCategories();
}

export const REFLECTIONS_VOTING = {
  // Voting opens at site launch; already open for development.
  opensAt: "2026-07-13T00:00:00+04:00",
  closesAt: "2026-08-31T23:59:59+04:00",
  // Internal only (e.g. founding fan badge). No public winners announcement on site.
  foundingCutoff: "2026-09-01",
};

export function getOpenCategories() {
  return getReflectionsLiveCategories();
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

// Home page hero: crowd band at the bottom of The Tree (behind doors).
// Drop a real matchday still into public/stills/ and set the path here.
// null = no footage layer (beams + grain only; never a drawn crowd).
// Example: "/stills/home-hero-crowd.webp"
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

// Home page band order. null = voting layout. Set to "results" only for previews.
export const HOME_SECTION_LAYOUT = null;

export const HOME_SECTION_ORDERS = {
  voting: ["reflections", "guesser", "films", "stats", "newsletter"],
  results: ["films", "guesser", "reflections", "stats", "newsletter"],
};

/** Default stays on voting layout. No site winners flip. */
export function getHomeSectionLayout() {
  if (HOME_SECTION_LAYOUT === "voting" || HOME_SECTION_LAYOUT === "results") {
    return HOME_SECTION_LAYOUT;
  }
  return "voting";
}

export function getHomeSectionOrder(now = new Date()) {
  return HOME_SECTION_ORDERS[getHomeSectionLayout(now)];
}

/** Long-form formats on the Films tab. Shorts live on the Shorts tab. */
export const FILMS_TAB_FORMATS = [
  "catchmentary",
  "podcast",
  "explainer",
  "compilation",
];

/** @deprecated Use FILMS_TAB_FORMATS. Kept for home latest-films helper. */
export const FILMS_GRID_FORMATS = FILMS_TAB_FORMATS;
