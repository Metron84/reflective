import { FANS_LABEL, FANS_URL } from "@/lib/play/links.js";
import styles from "./fans.module.css";

function InstagramIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function FansButton({ className = "" }) {
  return (
    <a href={FANS_URL} target="_blank" rel="noopener noreferrer" className={`${styles.fans} ${className}`}>
      <InstagramIcon />
      {FANS_LABEL}
    </a>
  );
}
