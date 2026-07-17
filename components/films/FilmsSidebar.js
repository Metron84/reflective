"use client";

import styles from "./FilmsSidebar.module.css";

export const FILMS_NAV_ENTIRE = "entire-collection";
export const FILMS_NAV_FILMS = "films";
export const FILMS_NAV_SHORTS = "shorts";
export const FILMS_NAV_PLAYLISTS = "playlists";

export const FILMS_NAV_ITEMS = [
  { id: FILMS_NAV_ENTIRE, label: "Entire Collection" },
  { id: FILMS_NAV_FILMS, label: "Films" },
  { id: FILMS_NAV_SHORTS, label: "Shorts" },
  { id: FILMS_NAV_PLAYLISTS, label: "Playlists" },
];

export default function FilmsSidebar({ active, onSelect }) {
  return (
    <nav className={styles.nav} aria-label="Films archive">
      <ul className={styles.list} role="list">
        {FILMS_NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          return (
            <li key={item.id} className={styles.item}>
              <button
                type="button"
                aria-current={isActive ? "page" : undefined}
                className={`${styles.link} ${isActive ? styles.linkActive : ""}`}
                onClick={() => onSelect(item.id)}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
