"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ArchiveEntry, ArchiveMedium, ArchiveRegion } from "@/lib/archive/types";
import {
  ARCHIVE_MEDIUM_LABELS,
  ARCHIVE_MEDIUM_ORDER,
} from "@/lib/archive/labels";
import ArchiveCard from "./ArchiveCard";
import styles from "./ArchiveIndex.module.css";

type ArchiveIndexProps = {
  entries: ArchiveEntry[];
};

function parseMedium(value: string | null): ArchiveMedium | "all" {
  if (!value || value === "all") return "all";
  if (value in ARCHIVE_MEDIUM_LABELS) return value as ArchiveMedium;
  return "all";
}

const ARCHIVE_REGIONS = new Set<ArchiveRegion>([
  "Europe",
  "South America",
  "North America",
  "Africa",
  "Asia",
  "Middle East",
  "Oceania",
  "International",
]);

function parseRegion(value: string | null): ArchiveRegion | "all" {
  if (!value || value === "all") return "all";
  if (ARCHIVE_REGIONS.has(value as ArchiveRegion)) {
    return value as ArchiveRegion;
  }
  return "all";
}

export default function ArchiveIndex({ entries }: ArchiveIndexProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeMedium = parseMedium(searchParams.get("medium"));
  const activeRegion = parseRegion(searchParams.get("region"));

  const mediumOptions = useMemo(() => {
    const present = new Set(entries.map((entry) => entry.medium));
    return ARCHIVE_MEDIUM_ORDER.filter((medium) => present.has(medium));
  }, [entries]);

  const regionOptions = useMemo(() => {
    const present = new Set(entries.map((entry) => entry.region));
    return [...present].sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const countsLine = useMemo(() => {
    const byMedium = new Map<ArchiveMedium, number>();
    for (const entry of entries) {
      byMedium.set(entry.medium, (byMedium.get(entry.medium) ?? 0) + 1);
    }
    const parts = [
      `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`,
    ];
    for (const medium of ARCHIVE_MEDIUM_ORDER) {
      const count = byMedium.get(medium);
      if (!count) continue;
      parts.push(`${count} ${ARCHIVE_MEDIUM_LABELS[medium]}`);
    }
    return parts.join(" · ");
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (activeMedium !== "all" && entry.medium !== activeMedium) return false;
      if (activeRegion !== "all" && entry.region !== activeRegion) return false;
      return true;
    });
  }, [entries, activeMedium, activeRegion]);

  const setParams = useCallback(
    (nextMedium: ArchiveMedium | "all", nextRegion: ArchiveRegion | "all") => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextMedium === "all") params.delete("medium");
      else params.set("medium", nextMedium);
      if (nextRegion === "all") params.delete("region");
      else params.set("region", nextRegion);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className={styles.index}>
      <p className={styles.counts}>{countsLine}</p>

      <div className={styles.filters}>
        <div
          className={styles.mediumRow}
          role="group"
          aria-label="Filter by medium"
        >
          <button
            type="button"
            className={styles.pill}
            aria-pressed={activeMedium === "all"}
            onClick={() => setParams("all", activeRegion)}
          >
            All
          </button>
          {mediumOptions.map((medium) => (
            <button
              key={medium}
              type="button"
              className={styles.pill}
              aria-pressed={activeMedium === medium}
              onClick={() => setParams(medium, activeRegion)}
            >
              {ARCHIVE_MEDIUM_LABELS[medium]}
            </button>
          ))}
        </div>

        <div className={styles.regionBlock}>
          <label className={styles.regionLabel} htmlFor="archive-region">
            Region
          </label>

          <select
            id="archive-region"
            className={styles.regionSelect}
            value={activeRegion}
            onChange={(event) =>
              setParams(
                activeMedium,
                parseRegion(event.target.value || "all"),
              )
            }
          >
            <option value="all">All regions</option>
            {regionOptions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>

          <div
            className={styles.regionPills}
            role="group"
            aria-label="Filter by region"
          >
            <button
              type="button"
              className={styles.pill}
              aria-pressed={activeRegion === "all"}
              onClick={() => setParams(activeMedium, "all")}
            >
              All regions
            </button>
            {regionOptions.map((region) => (
              <button
                key={region}
                type="button"
                className={styles.pill}
                aria-pressed={activeRegion === region}
                onClick={() => setParams(activeMedium, region)}
              >
                {region}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.noMatches}>No entries match these filters.</p>
      ) : (
        <ul className={styles.grid}>
          {filtered.map((entry) => (
            <li key={entry.id}>
              <ArchiveCard entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
