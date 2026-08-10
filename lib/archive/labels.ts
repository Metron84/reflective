import type { ArchiveMedium } from "@/lib/archive/types";

/** Plain-English medium labels for filters and counts. */
export const ARCHIVE_MEDIUM_LABELS: Record<ArchiveMedium, string> = {
  documentary: "Documentaries",
  docuseries: "Series",
  film: "Films",
  book: "Books",
  photography: "Photography",
  music: "Music",
  artwork: "Art",
  museum: "Museums",
  exhibition: "Exhibitions",
};

/** Singular medium tags for entry pages. */
export const ARCHIVE_MEDIUM_TAGS: Record<ArchiveMedium, string> = {
  documentary: "Documentary",
  docuseries: "Series",
  film: "Film",
  book: "Book",
  photography: "Photography",
  music: "Music",
  artwork: "Art",
  museum: "Museum",
  exhibition: "Exhibition",
};

/** Display order for medium filters and count lines. */
export const ARCHIVE_MEDIUM_ORDER: ArchiveMedium[] = [
  "documentary",
  "docuseries",
  "film",
  "book",
  "photography",
  "music",
  "artwork",
  "museum",
  "exhibition",
];
