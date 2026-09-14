"use client";

import styles from "./Reveal.module.css";

/**
 * Fade-up reveal on mount. Respects prefers-reduced-motion via CSS.
 * @param {{ delay?: number; className?: string; children: React.ReactNode }} props
 */
export default function Reveal({ delay = 0, className = "", children }) {
  return (
    <div
      className={`${styles.reveal} ${className}`.trim()}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
