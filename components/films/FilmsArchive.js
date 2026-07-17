"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  filterFilms,
  getFilterOptions,
  partitionFeatured,
} from "@/lib/films/filters";
import ArchiveFilmCard from "./ArchiveFilmCard";
import ShortFilmCard from "./ShortFilmCard";
import FilmsFilters from "./FilmsFilters";
import FilmsSidebar, { FILMS_NAV_ENTIRE } from "./FilmsSidebar";
import CollectionsBand from "./CollectionsBand";
import styles from "./FilmsArchive.module.css";

const PAGE_SIZE = 24;

export default function FilmsArchive({
  filmsTabFilms,
  shortsFilms,
  collections,
}) {
  const searchParams = useSearchParams();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeNav, setActiveNav] = useState(FILMS_NAV_ENTIRE);

  const tab = searchParams.get("tab") === "shorts" ? "shorts" : "films";
  const isShorts = tab === "shorts";
  const tabFilms = isShorts ? shortsFilms : filmsTabFilms;

  const filters = useMemo(
    () => ({
      club: searchParams.get("club") ?? "",
      venue: searchParams.get("venue") ?? "",
      collection: searchParams.get("collection") ?? "",
    }),
    [searchParams]
  );

  const filterOptions = useMemo(
    () => getFilterOptions(tabFilms),
    [tabFilms]
  );

  const filtered = useMemo(
    () => filterFilms(tabFilms, filters),
    [tabFilms, filters]
  );

  const { featured, rest } = useMemo(
    () => (isShorts ? { featured: [], rest: filtered } : partitionFeatured(filtered)),
    [filtered, isShorts]
  );

  const visibleRest = rest.slice(0, visibleCount);
  const hasMore = visibleCount < rest.length;

  const hasAnyFilter = Boolean(
    filters.club || filters.venue || filters.collection
  );
  const isEmpty = filtered.length === 0;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters.club, filters.venue, filters.collection, tab]);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.layout}>
          <FilmsSidebar active={activeNav} onSelect={setActiveNav} />

          <div className={styles.main}>
            <div className={styles.controls}>
              <CollectionsBand collections={collections} />
              <FilmsFilters options={filterOptions} />
            </div>

            <div id="films-archive-panel">
              {isEmpty ? (
                <div className={styles.empty}>
                  <p className={styles.emptyCopy}>
                    {isShorts
                      ? "No shorts there yet. The cameras are always rolling."
                      : "No films there yet. The cameras are always rolling."}
                  </p>
                  {hasAnyFilter ? <ClearFiltersLink tab={tab} /> : null}
                </div>
              ) : (
                <>
                  {!isShorts && featured.length > 0 ? (
                    <section
                      className={styles.featuredSection}
                      aria-label="Featured films"
                    >
                      <ul className={styles.featuredGrid}>
                        {featured.map((film) => (
                          <li key={film.slug}>
                            <ArchiveFilmCard film={film} featured />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  <section aria-label={isShorts ? "Shorts archive" : "Film archive"}>
                    <ul className={isShorts ? styles.shortsGrid : styles.grid}>
                      {visibleRest.map((film) => (
                        <li key={film.slug}>
                          {isShorts ? (
                            <ShortFilmCard film={film} />
                          ) : (
                            <ArchiveFilmCard film={film} />
                          )}
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
                          {isShorts ? "Load more shorts" : "Load more films"}
                        </button>
                      </div>
                    ) : null}
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClearFiltersLink({ tab }) {
  const href = tab === "shorts" ? "/films?tab=shorts" : "/films";
  return (
    <a href={href} className={styles.clearLink}>
      Clear filters
    </a>
  );
}
