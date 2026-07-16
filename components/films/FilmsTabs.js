"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./FilmsTabs.module.css";

export const FILMS_TAB = "films";
export const SHORTS_TAB = "shorts";

export function parseFilmsTab(value) {
  return value === SHORTS_TAB ? SHORTS_TAB : FILMS_TAB;
}

export default function FilmsTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = parseFilmsTab(searchParams.get("tab"));

  function setTab(tab) {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === FILMS_TAB) {
      next.delete("tab");
    } else {
      next.set("tab", SHORTS_TAB);
    }
    next.delete("collection");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs} role="tablist" aria-label="Archive type">
        <button
          type="button"
          role="tab"
          id="films-tab-films"
          aria-selected={active === FILMS_TAB}
          aria-controls="films-archive-panel"
          className={`${styles.tab} ${active === FILMS_TAB ? styles.tabActive : ""}`}
          onClick={() => setTab(FILMS_TAB)}
        >
          Films
        </button>
        <button
          type="button"
          role="tab"
          id="films-tab-shorts"
          aria-selected={active === SHORTS_TAB}
          aria-controls="films-archive-panel"
          className={`${styles.tab} ${active === SHORTS_TAB ? styles.tabActive : ""}`}
          onClick={() => setTab(SHORTS_TAB)}
        >
          Shorts
        </button>
      </div>
    </div>
  );
}
