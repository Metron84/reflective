"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  filterFilms,
  getFilterOptions,
  sortFilmsByPublished,
} from "@/lib/films/filters";
import ArchiveFilmCard from "./ArchiveFilmCard";
import ShortFilmCard from "./ShortFilmCard";
import FilmsSidebar, {
  FILMS_NAV_ENTIRE,
  FILMS_NAV_FILMS,
  FILMS_NAV_SHORTS,
} from "./FilmsSidebar";
import {
  FILTER_TYPE_CLUB,
  FILTER_TYPE_NATION,
  FILTER_TYPE_VENUE,
} from "./FilmsFilterPanel";
import styles from "./FilmsArchive.module.css";

const PAGE_SIZE = 24;

function parseActiveNav(tab) {
  if (tab === "shorts") return FILMS_NAV_SHORTS;
  if (tab === "films") return FILMS_NAV_FILMS;
  return FILMS_NAV_ENTIRE;
}

function navToTab(nav) {
  if (nav === FILMS_NAV_SHORTS) return "shorts";
  if (nav === FILMS_NAV_FILMS) return "films";
  return null;
}

export default function FilmsArchive({ filmsTabFilms, shortsFilms }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const activeNav = parseActiveNav(searchParams.get("tab"));
  const isShortsOnly = activeNav === FILMS_NAV_SHORTS;
  const isFilmsOnly = activeNav === FILMS_NAV_FILMS;

  const filters = useMemo(
    () => ({
      club: searchParams.get("club") ?? "",
      nation: searchParams.get("nation") ?? "",
      venue: searchParams.get("venue") ?? "",
    }),
    [searchParams]
  );

  const activeFilter = useMemo(() => {
    if (filters.club) return { type: FILTER_TYPE_CLUB, value: filters.club };
    if (filters.nation) return { type: FILTER_TYPE_NATION, value: filters.nation };
    if (filters.venue) return { type: FILTER_TYPE_VENUE, value: filters.venue };
    return null;
  }, [filters]);

  const scopeFilms = useMemo(() => {
    if (isShortsOnly) return shortsFilms;
    if (isFilmsOnly) return filmsTabFilms;

    const bySlug = new Map();
    for (const film of [...filmsTabFilms, ...shortsFilms]) {
      bySlug.set(film.slug, film);
    }
    return sortFilmsByPublished([...bySlug.values()]);
  }, [filmsTabFilms, shortsFilms, isShortsOnly, isFilmsOnly]);

  const filterOptions = useMemo(
    () => getFilterOptions(scopeFilms),
    [scopeFilms]
  );

  const filterGroups = useMemo(
    () => [
      {
        id: "clubs",
        label: "Clubs",
        filterType: FILTER_TYPE_CLUB,
        items: filterOptions.clubs,
      },
      {
        id: "nations",
        label: "Nations",
        filterType: FILTER_TYPE_NATION,
        items: filterOptions.nations,
      },
      {
        id: "venues",
        label: "Venues",
        filterType: FILTER_TYPE_VENUE,
        items: filterOptions.venues,
      },
    ],
    [filterOptions]
  );

  const filtered = useMemo(
    () => sortFilmsByPublished(filterFilms(scopeFilms, filters)),
    [scopeFilms, filters]
  );

  const visibleFilms = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const hasAnyFilter = Boolean(
    filters.club || filters.nation || filters.venue
  );
  const isEmpty = filtered.length === 0;

  const replaceParams = useCallback(
    (mutate) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const onNavSelect = useCallback(
    (nav) => {
      replaceParams((next) => {
        next.delete("club");
        next.delete("nation");
        next.delete("venue");
        next.delete("collection");
        const tab = navToTab(nav);
        if (tab) next.set("tab", tab);
        else next.delete("tab");
      });
    },
    [replaceParams]
  );

  const onFilterSelect = useCallback(
    (type, value) => {
      replaceParams((next) => {
        next.delete("club");
        next.delete("nation");
        next.delete("venue");
        next.delete("collection");
        next.set(type, value);
      });
    },
    [replaceParams]
  );

  const onFilterClear = useCallback(() => {
    replaceParams((next) => {
      next.delete("club");
      next.delete("nation");
      next.delete("venue");
    });
  }, [replaceParams]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [
    filters.club,
    filters.nation,
    filters.venue,
    activeNav,
  ]);

  const gridClass = isShortsOnly ? styles.shortsGrid : styles.grid;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.layout}>
          <div className={styles.sidebarSlot}>
            <FilmsSidebar
              active={activeNav}
              onSelect={onNavSelect}
              filterGroups={filterGroups}
              activeFilter={activeFilter}
              onFilterSelect={onFilterSelect}
              onFilterClear={onFilterClear}
            />
          </div>

          <div className={styles.main}>
            <div id="films-archive-panel" className={styles.panel}>
              {isEmpty ? (
                <div className={styles.empty}>
                  <p className={styles.emptyCopy}>
                    {isShortsOnly
                      ? "No shorts there yet. The cameras are always rolling."
                      : "No films there yet. The cameras are always rolling."}
                  </p>
                  {hasAnyFilter ? (
                    <button
                      type="button"
                      className={styles.clearLink}
                      onClick={onFilterClear}
                    >
                      Clear filters
                    </button>
                  ) : null}
                </div>
              ) : (
                <section
                  aria-label={
                    isShortsOnly
                      ? "Shorts archive"
                      : isFilmsOnly
                        ? "Film archive"
                        : "Films archive"
                  }
                >
                  <ul className={gridClass}>
                    {visibleFilms.map((film) => (
                      <li key={film.slug}>
                        {film.format === "short_film" ? (
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
                        {isShortsOnly ? "Load more shorts" : "Load more films"}
                      </button>
                    </div>
                  ) : null}
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
