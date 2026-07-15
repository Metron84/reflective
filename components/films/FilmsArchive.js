"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  filterFilms,
  partitionFeatured,
} from "@/lib/films/filters";
import ArchiveFilmCard from "./ArchiveFilmCard";
import FilmsFilters from "./FilmsFilters";
import styles from "./FilmsArchive.module.css";

const PAGE_SIZE = 24;

export default function FilmsArchive({ films, filterOptions }) {
  const searchParams = useSearchParams();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filters = useMemo(
    () => ({
      club: searchParams.get("club") ?? "",
      venue: searchParams.get("venue") ?? "",
    }),
    [searchParams]
  );

  const filtered = useMemo(
    () => filterFilms(films, filters),
    [films, filters]
  );

  const { featured, rest } = useMemo(
    () => partitionFeatured(filtered),
    [filtered]
  );

  const visibleRest = rest.slice(0, visibleCount);
  const hasMore = visibleCount < rest.length;

  const hasFilters = Boolean(filters.club || filters.venue);
  const isEmpty = filtered.length === 0;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters.club, filters.venue]);

  return (
    <div className={styles.archive}>
      <FilmsFilters options={filterOptions} />

      {isEmpty ? (
        <div className={styles.empty}>
          <p className={styles.emptyCopy}>
            No films there yet. The cameras are always rolling.
          </p>
          {hasFilters ? (
            <ClearFiltersLink />
          ) : null}
        </div>
      ) : (
        <>
          {featured.length > 0 ? (
            <section className={styles.featuredSection} aria-label="Featured films">
              <ul className={styles.featuredGrid}>
                {featured.map((film) => (
                  <li key={film.slug}>
                    <ArchiveFilmCard film={film} featured />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-label="Film archive">
            <ul className={styles.grid}>
              {visibleRest.map((film) => (
                <li key={film.slug}>
                  <ArchiveFilmCard film={film} />
                </li>
              ))}
            </ul>
            {hasMore ? (
              <div className={styles.moreWrap}>
                <button
                  type="button"
                  className={styles.moreBtn}
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                >
                  Load more films
                </button>
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

function ClearFiltersLink() {
  return (
    <a href="/films" className={styles.clearLink}>
      Clear filters
    </a>
  );
}
