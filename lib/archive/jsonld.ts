import { SITE_URL } from "@/lib/config";
import type { ArchiveEntry, ArchiveMedium } from "@/lib/archive/types";

const SCHEMA_TYPE_BY_MEDIUM: Record<ArchiveMedium, string> = {
  documentary: "Movie",
  film: "Movie",
  docuseries: "TVSeries",
  book: "Book",
  photography: "Photograph",
  music: "MusicRecording",
  artwork: "VisualArtwork",
  museum: "Museum",
  exhibition: "VisualArtwork",
};

/** schema.org JSON-LD for a published (or preview) archive entry. */
export function buildArchiveEntryJsonLd(entry: ArchiveEntry) {
  const url = `${SITE_URL}/archive/${entry.id}`;
  const schemaType = SCHEMA_TYPE_BY_MEDIUM[entry.medium] ?? "CreativeWork";

  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: entry.title,
    description: entry.logline,
    url,
    inLanguage: entry.language,
  };

  if (entry.originalTitle) {
    base.alternateName = entry.originalTitle;
  }
  if (entry.year != null) {
    base.datePublished = String(entry.year);
  }
  if (entry.country) {
    base.countryOfOrigin = entry.country;
  }

  if (schemaType === "Movie" || schemaType === "TVSeries") {
    base.director = { "@type": "Person", name: entry.creator };
    if (entry.runtimeOrLength) base.duration = entry.runtimeOrLength;
  } else if (schemaType === "Book") {
    base.author = { "@type": "Person", name: entry.creator };
  } else if (schemaType === "MusicRecording") {
    base.byArtist = { "@type": "MusicGroup", name: entry.creator };
  } else if (schemaType === "Photograph" || schemaType === "VisualArtwork") {
    base.creator = { "@type": "Person", name: entry.creator };
  } else if (schemaType === "Museum") {
    base.name = entry.title;
    base.description = entry.logline;
  } else {
    base.creator = { "@type": "Person", name: entry.creator };
  }

  return base;
}
