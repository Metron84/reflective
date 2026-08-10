"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ArchiveEntry, ArchiveMedium, ArchiveRegion } from "@/lib/archive/types";
import {
  ARCHIVE_MEDIUM_LABELS,
  ARCHIVE_MEDIUM_ORDER,
} from "@/lib/archive/labels";
import {
  matchesQuery,
  type ArchiveSearchRecord,
} from "@/lib/archive/search";
import ArchiveCard from "./ArchiveCard";
import styles from "./ArchiveIndex.module.css";

type ArchiveIndexProps = {
  entries: ArchiveEntry[];
  searchIndex: ArchiveSearchRecord[];
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

export default function ArchiveIndex({ entries, searchIndex }: ArchiveIndexProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeMedium = parseMedium(searchParams.get("medium"));
  const activeRegion = parseRegion(searchParams.get("region"));
  const activeQuery = searchParams.get("q")?.trim() ?? "";

  const [draftQuery, setDraftQuery] = useState(activeQuery);

  useEffect(() => {
    setDraftQuery(activeQuery);
  }, [activeQuery]);

  const haystackById = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of searchIndex) {
      map.set(record.id, record.haystack);
    }
    return map;
  }, [searchIndex]);

  const mediumCounts = useMemo(() => {
    const byMedium = new Map<ArchiveMedium, number>();
    for (const medium of ARCHIVE_MEDIUM_ORDER) byMedium.set(medium, 0);
    for (const entry of entries) {
      byMedium.set(entry.medium, (byMedium.get(entry.medium) ?? 0) + 1);
    }
    return byMedium;
  }, [entries]);

  const regionOptions = useMemo(() => {
    const present = new Set(entries.map((entry) => entry.region));
    return [...present].sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const filtersActive =
    activeMedium !== "all" || activeRegion !== "all" || activeQuery.length > 0;

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (activeMedium !== "all" && entry.medium !== activeMedium) return false;
      if (activeRegion !== "all" && entry.region !== activeRegion) return false;
      if (activeQuery) {
        const haystack = haystackById.get(entry.id) ?? "";
        if (!matchesQuery(haystack, activeQuery)) return false;
      }
      return true;
    });
  }, [entries, activeMedium, activeRegion, activeQuery, haystackById]);

  const countsLine = useMemo(() => {
    if (filtersActive) {
      return `${filtered.length} of ${entries.length}`;
    }

    const parts = [
      `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`,
    ];
    for (const medium of ARCHIVE_MEDIUM_ORDER) {
      const count = mediumCounts.get(medium) ?? 0;
      parts.push(`${count} ${ARCHIVE_MEDIUM_LABELS[medium]}`);
    }
    return parts.join(" · ");
  }, [entries.length, filtered.length, filtersActive, mediumCounts]);

  const replaceParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const setMediumRegion = useCallback(
    (nextMedium: ArchiveMedium | "all", nextRegion: ArchiveRegion | "all") => {
      replaceParams((params) => {
        if (nextMedium === "all") params.delete("medium");
        else params.set("medium", nextMedium);
        if (nextRegion === "all") params.delete("region");
        else params.set("region", nextRegion);
      });
    },
    [replaceParams],
  );

  const clearAll = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = draftQuery.trim();
      const current = activeQuery;
      if (next === current) return;
      replaceParams((params) => {
        if (!next) params.delete("q");
        else params.set("q", next);
      });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [draftQuery, activeQuery, replaceParams]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className={styles.index}>
      <div className={styles.countsRow}>
        <p className={styles.counts} aria-live="polite">
          {countsLine}
        </p>
        {filtersActive ? (
          <button type="button" className={styles.clearAll} onClick={clearAll}>
            Clear all
          </button>
        ) : null}
      </div>

      <div className={styles.filters}>
        <div className={styles.filterTop}>
          <div className={styles.searchField}>
            <label htmlFor="archive-search" className={styles.srOnly}>
              Search by title, creator or subject
            </label>
            <input
              id="archive-search"
              type="search"
              className={styles.searchInput}
              placeholder="Search by title, creator or subject"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>

          <div
            className={styles.mediumRow}
            role="group"
            aria-label="Filter by medium"
          >
            <button
              type="button"
              className={styles.pill}
              aria-pressed={activeMedium === "all"}
              onClick={() => setMediumRegion("all", activeRegion)}
            >
              All
            </button>
            {ARCHIVE_MEDIUM_ORDER.map((medium) => {
              const count = mediumCounts.get(medium) ?? 0;
              if (count === 0) {
                return (
                  <span
                    key={medium}
                    className={styles.pillSoon}
                    aria-disabled="true"
                    aria-label={`${ARCHIVE_MEDIUM_LABELS[medium]} coming soon`}
                  >
                    Soon
                  </span>
                );
              }
              return (
                <button
                  key={medium}
                  type="button"
                  className={styles.pill}
                  aria-pressed={activeMedium === medium}
                  onClick={() => setMediumRegion(medium, activeRegion)}
                >
                  {ARCHIVE_MEDIUM_LABELS[medium]}
                </button>
              );
            })}
          </div>
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
              setMediumRegion(
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
              onClick={() => setMediumRegion(activeMedium, "all")}
            >
              All regions
            </button>
            {regionOptions.map((region) => (
              <button
                key={region}
                type="button"
                className={styles.pill}
                aria-pressed={activeRegion === region}
                onClick={() => setMediumRegion(activeMedium, region)}
              >
                {region}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.noMatches}>
          <p className={styles.noMatchesText}>Nothing matches that.</p>
          {filtersActive ? (
            <button type="button" className={styles.clearAll} onClick={clearAll}>
              Clear all
            </button>
          ) : null}
        </div>
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
