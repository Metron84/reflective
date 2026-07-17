"use client";

import { useState } from "react";
import {
  Film,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Smartphone,
} from "lucide-react";
import styles from "./FilmsSidebar.module.css";

export const FILMS_NAV_ENTIRE = "entire-collection";
export const FILMS_NAV_FILMS = "films";
export const FILMS_NAV_SHORTS = "shorts";

const PRIMARY_ITEMS = [
  { id: FILMS_NAV_ENTIRE, label: "Entire Collection", Icon: LayoutGrid },
  { id: FILMS_NAV_FILMS, label: "Films", Icon: Film },
  { id: FILMS_NAV_SHORTS, label: "Shorts", Icon: Smartphone },
];

function PrimaryNavButton({ item, isActive, collapsed, onSelect }) {
  const { Icon, label, id } = item;

  return (
    <li className={styles.item}>
      <button
        type="button"
        aria-current={isActive ? "page" : undefined}
        aria-label={collapsed ? label : undefined}
        data-tooltip={collapsed ? label : undefined}
        className={`${styles.navButton} ${isActive ? styles.navButtonActive : ""}`}
        onClick={() => onSelect(id)}
      >
        <Icon className={styles.icon} strokeWidth={1.75} aria-hidden />
        <span className={styles.label}>{label}</span>
      </button>
    </li>
  );
}

export default function FilmsSidebar({ active, onSelect }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={styles.root}
      data-collapsed={collapsed ? "true" : "false"}
    >
      <nav className={styles.mobileNav} aria-label="Films archive">
        <ul className={styles.mobileList} role="list">
          {PRIMARY_ITEMS.map((item) => {
            const isActive = active === item.id;
            return (
              <li key={item.id} className={styles.mobileItem}>
                <button
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  className={`${styles.mobilePill} ${isActive ? styles.mobilePillActive : ""}`}
                  onClick={() => onSelect(item.id)}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <aside className={styles.desktopShell}>
        <div className={styles.card}>
          <nav className={styles.primaryNav} aria-label="Films archive">
            <ul className={styles.desktopList} role="list">
              {PRIMARY_ITEMS.map((item) => (
                <PrimaryNavButton
                  key={item.id}
                  item={item}
                  isActive={active === item.id}
                  collapsed={collapsed}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </nav>

          <hr className={styles.divider} />

          <div className={styles.secondarySection} aria-label="Categories" />

          <button
            type="button"
            className={styles.collapseToggle}
            onClick={() => setCollapsed((current) => !current)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className={styles.toggleIcon} strokeWidth={1.75} aria-hidden />
            ) : (
              <>
                <PanelLeftClose className={styles.toggleIcon} strokeWidth={1.75} aria-hidden />
                <span className={styles.toggleLabel}>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </div>
  );
}
