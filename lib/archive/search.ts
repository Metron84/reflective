import type { ArchiveEntry, ArchiveSubject } from "@/lib/archive/types";
import {
  ARCHIVE_MEDIUM_LABELS,
  ARCHIVE_MEDIUM_TAGS,
} from "@/lib/archive/labels";

export type ArchiveSearchRecord = {
  id: string;
  haystack: string;
};

const SUBJECT_SEARCH_TERMS: Record<ArchiveSubject, string> = {
  club: "club",
  nation: "nation national team country",
  player: "player footballer",
  fans: "fans supporters fandom terrace",
  tournament: "tournament world cup competition",
  culture: "culture society",
  politics: "politics political power",
  tactics: "tactics tactical coaching",
};

function entryHaystack(entry: ArchiveEntry): string {
  return [
    entry.title,
    entry.originalTitle,
    entry.creator,
    entry.subjectName,
    SUBJECT_SEARCH_TERMS[entry.subject],
    entry.country,
    entry.region,
    ARCHIVE_MEDIUM_LABELS[entry.medium],
    ARCHIVE_MEDIUM_TAGS[entry.medium],
    entry.logline,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Precompute lowercased search haystacks for archive entries. */
export function buildSearchIndex(entries: ArchiveEntry[]): ArchiveSearchRecord[] {
  return entries.map((entry) => ({
    id: entry.id,
    haystack: entryHaystack(entry),
  }));
}

/** Every whitespace token must be a substring of the haystack. */
export function matchesQuery(haystack: string, query: string): boolean {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => haystack.includes(token));
}
