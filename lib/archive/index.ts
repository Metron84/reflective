import type {
  ArchiveEntry,
  ArchiveMedium,
  ArchiveRegion,
} from "@/lib/archive/types";
import entriesJson from "@/content/archive/entries.json";
import holdingJson from "@/content/archive/holding.json";

const entries = entriesJson as ArchiveEntry[];
const holding = holdingJson as ArchiveEntry[];

/** Published archive entries only. */
export function getAllEntries(): ArchiveEntry[] {
  return entries.filter((entry) => entry.status === "published");
}

export function getEntryById(id: string): ArchiveEntry | undefined {
  return getAllEntries().find((entry) => entry.id === id);
}

export function getEntriesByMedium(medium: ArchiveMedium): ArchiveEntry[] {
  return getAllEntries().filter((entry) => entry.medium === medium);
}

export function getEntriesByRegion(region: ArchiveRegion): ArchiveEntry[] {
  return getAllEntries().filter((entry) => entry.region === region);
}

export function getHoldingEntries(): ArchiveEntry[] {
  return holding.filter((entry) => entry.status === "holding");
}
