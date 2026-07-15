"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./FilmsFilters.module.css";

function toggleParam(params, key, value) {
  const next = new URLSearchParams(params.toString());
  const current = next.get(key);
  if (current === value) {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  return next;
}

export default function FilmsFilters({ options }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeClub = searchParams.get("club") ?? "";
  const activeVenue = searchParams.get("venue") ?? "";

  const hasActive = Boolean(activeClub || activeVenue);

  const pushParams = useCallback(
    (next) => {
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const onClub = useCallback(
    (club) => {
      pushParams(toggleParam(searchParams, "club", club));
    },
    [pushParams, searchParams]
  );

  const onVenue = useCallback(
    (venue) => {
      pushParams(toggleParam(searchParams, "venue", venue));
    },
    [pushParams, searchParams]
  );

  const clearAll = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const groups = useMemo(
    () => [
      {
        id: "club",
        label: "Club / nation",
        items: options.clubs,
        active: activeClub,
        onToggle: onClub,
      },
      {
        id: "venue",
        label: "Venue",
        items: options.venues,
        active: activeVenue,
        onToggle: onVenue,
      },
    ],
    [options, activeClub, activeVenue, onClub, onVenue]
  );

  return (
    <div className={styles.bar}>
      {groups.map((group) =>
        group.items.length > 0 ? (
          <div key={group.id} className={styles.group}>
            <span className={styles.groupLabel}>{group.label}</span>
            <ul className={styles.chips} role="list">
              {group.items.map((item) => {
                const isActive = group.active === item;
                return (
                  <li key={`${group.id}-${item}`}>
                    <button
                      type="button"
                      className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
                      aria-pressed={isActive}
                      onClick={() => group.onToggle(item)}
                    >
                      {item}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null
      )}
      {hasActive ? (
        <button type="button" className={styles.clear} onClick={clearAll}>
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
