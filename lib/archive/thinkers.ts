import generated from "@/content/archive/thinkers.generated.json";

export type ArchiveThinker = {
  id: string;
  name: string;
  domain: string;
  era: string;
  question: string;
  reads: string;
  breaks: string;
  insight: string;
};

export type ArchiveThinkerRecord = {
  entryId: string;
  maker: ArchiveThinker | null;
  thinkers: ArchiveThinker[];
};

const records = generated as ArchiveThinkerRecord[];

/**
 * Thinker lens for an archive entry, built at deploy time from the master thinkers
 * database (scripts/build-archive-thinkers.mjs). Null when none was generated.
 */
export function getThinkersForEntry(entryId: string): ArchiveThinkerRecord | null {
  return records.find((item) => item.entryId === entryId) ?? null;
}
