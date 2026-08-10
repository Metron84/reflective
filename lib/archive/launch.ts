import entriesJson from "@/content/archive/entries.json";
import type { ArchiveEntry } from "@/lib/archive/types";

/** Finish List §4: launch-readiness bar for public archive scale. */
export const ARCHIVE_LAUNCH_PUBLISHED_THRESHOLD = 100;

export function getPublishedEntryCount(): number {
  const entries = entriesJson as ArchiveEntry[];
  return entries.filter((entry) => entry.status === "published").length;
}

/**
 * True when published count meets the launch bar.
 * SEO pieces (sitemap, JSON-LD, canonical, OG) ship ungated below this;
 * use this for features that should wait for ~100 published.
 */
export function isArchiveLaunchReady(): boolean {
  return getPublishedEntryCount() >= ARCHIVE_LAUNCH_PUBLISHED_THRESHOLD;
}
