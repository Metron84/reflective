import type { ArchiveEntry } from "@/lib/archive/types";

/**
 * Related entries for an archive detail page.
 * Priority: same subjectName, then same region+medium, then same region.
 */
export function getRelatedEntries(
  entry: ArchiveEntry,
  pool: ArchiveEntry[],
  limit = 3,
): ArchiveEntry[] {
  const others = pool.filter((candidate) => candidate.id !== entry.id);
  const picked: ArchiveEntry[] = [];
  const seen = new Set<string>();

  const take = (match: (candidate: ArchiveEntry) => boolean) => {
    for (const candidate of others) {
      if (picked.length >= limit) return;
      if (seen.has(candidate.id)) continue;
      if (!match(candidate)) continue;
      seen.add(candidate.id);
      picked.push(candidate);
    }
  };

  take((candidate) => candidate.subjectName === entry.subjectName);
  take(
    (candidate) =>
      candidate.region === entry.region && candidate.medium === entry.medium,
  );
  take((candidate) => candidate.region === entry.region);

  return picked;
}
