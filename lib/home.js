/** Homepage data. Hard-coded on purpose: never read from channel_stats. */
export const REACH = {
  value: "500K+",
  count: 500,
  label: "unique viewers",
};

/**
 * The four doors on the homepage. `images` is a pool; the server picks one per
 * GST day (see getHomeDoors in lib/homepage-status.js). `focus` is a CSS
 * object-position value.
 */
export const DOORS = [
  {
    key: "games",
    label: "Games",
    href: "/games",
    status: "Six games. Are You Really a Fan, The Crest and more.",
    live: false,
    // Games is fixed to one image (no daily rotation). Alternative:
    // { src: "/home/doors/games-spurs.jpg", focus: "10% 40%" },
    images: [{ src: "/home/doors/games-westham.jpg", focus: "60% 35%" }],
  },
  {
    key: "competitions",
    label: "Competitions",
    href: "/competitions",
    status: "King of the Burgers: applications open",
    live: true,
    images: [
      { src: "/home/doors/competitions-mario.jpg", focus: "38% 40%" },
      { src: "/home/doors/competitions-manutd.jpg", focus: "50% 40%" },
    ],
  },
  {
    key: "events",
    label: "Events",
    href: "/events",
    status: "Find where your club watches in Dubai",
    live: false,
    images: [
      { src: "/home/doors/events-arsenal.jpg", focus: "48% 45%" },
      { src: "/home/doors/events-villa.jpg", focus: "48% 40%" },
    ],
  },
  {
    key: "observatory",
    label: "Observatory",
    href: "/observatory",
    status: "400+ fans interviewed. One open study.",
    live: true,
    images: [{ src: "/home/doors/observatory-chelsea.jpg", focus: "55% 50%" }],
  },
];

/** Shape: { label, date, href }. The strip renders only when this is set. */
export const NEXT_UP = null;

/** Flip true once monochrome badges are in /public/home/badges/. */
export const BADGES_ENABLED = false;
