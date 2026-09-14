"use client";

import styles from "./JourneyShell.module.css";

/**
 * @param {{ homingLabel?: string | null; progress?: number; children: import("react").ReactNode }} props
 */
export default function JourneyShell({ progress = 0, children }) {
  const pct = Math.round(Math.min(100, Math.max(0, progress * 100)));
  return (
    <div className={styles.shell}>
      <header className={styles.hud} aria-live="polite">
        <span className={styles.hudLabel}>The Crest</span>
        <span className={styles.homingMuted}>Finding your bearing</span>
        <span className={styles.hudProgress} aria-hidden="true">
          {pct}%
        </span>
      </header>
      <div className={styles.panel}>{children}</div>
    </div>
  );
}
