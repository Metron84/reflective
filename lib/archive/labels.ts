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
