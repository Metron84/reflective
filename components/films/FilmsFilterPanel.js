"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import styles from "./FilmsFilterPanel.module.css";

export const FILTER_TYPE_CLUB = "club";
export const FILTER_TYPE_NATION = "nation";
export const FILTER_TYPE_VENUE = "venue";

export default function FilmsFilterPanel({
  groups,
  activeFilter,
  onSelect,
  onClear,
  className = "",
}) {
  const [openGroups, setOpenGroups] = useState(() => new Set());

  function toggleGroup(id) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!groups.some((group) => group.items.length > 0)) {
    return null;
  }

  return (
    <div className={`${styles.panel} ${className}`.trim()}>
      {groups.map((group) => {
        if (group.items.length === 0) return null;
        const isOpen = openGroups.has(group.id);

        return (
          <div key={group.id} className={styles.group}>
            <button
              type="button"
              className={styles.groupHeader}
              aria-expanded={isOpen}
              onClick={() => toggleGroup(group.id)}
            >
              <span className={styles.groupLabel}>{group.label}</span>
              <ChevronDown
                className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
                strokeWidth={1.75}
                aria-hidden
              />
            </button>
            {isOpen ? (
              <ul className={styles.itemList} role="list">
                {group.items.map((item) => {
                  const isActive =
                    activeFilter?.type === group.filterType &&
                    activeFilter?.value === item;

                  return (
                    <li key={`${group.id}-${item}`}>
                      {isActive ? (
                        <div className={styles.activeRow}>
                          <span className={styles.activeLabel}>{item}</span>
                          <button
                            type="button"
                            className={styles.clearBtn}
                            aria-label={`Clear ${item} filter`}
                            onClick={onClear}
                          >
                            <X className={styles.clearIcon} strokeWidth={2} aria-hidden />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={styles.itemLink}
                          onClick={() => onSelect(group.filterType, item)}
                        >
                          {item}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
