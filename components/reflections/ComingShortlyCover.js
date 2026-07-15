import styles from "./ComingShortlyCover.module.css";

export default function ComingShortlyCover() {
  return (
    <div className={styles.block}>
      <AwardsLaurelInner />
      <p className={styles.label}>Nominees announced shortly.</p>
    </div>
  );
}

function AwardsLaurelInner() {
  return (
    <svg className={styles.laurel} viewBox="0 0 28 28" aria-hidden="true">
      <path
        d="M14 4c-3.2 0-5.5 2.4-5.5 5.2 0 2.2 1.2 4 3 5.1L10 22h8l-1.5-7.7c1.8-1.1 3-2.9 3-5.1C19.5 6.4 17.2 4 14 4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 22h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 24.5h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
