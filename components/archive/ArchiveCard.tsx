import Link from "next/link";
import type { ArchiveEntry } from "@/lib/archive/types";
import { ARCHIVE_MEDIUM_LABELS } from "@/lib/archive/labels";
import styles from "./ArchiveCard.module.css";

type ArchiveCardProps = {
  entry: ArchiveEntry;
};

export default function ArchiveCard({ entry }: ArchiveCardProps) {
  const yearLabel = entry.year == null ? null : String(entry.year);
  const showUnverified = entry.status === "holding";

  return (
    <Link href={`/archive/${entry.id}`} className={styles.card}>
      <div className={styles.meta}>
        <span className={styles.medium}>
          {ARCHIVE_MEDIUM_LABELS[entry.medium]}
        </span>
        {showUnverified ? (
          <span className={styles.unverified}>unverified</span>
        ) : null}
      </div>

      <h2 className={styles.title}>{entry.title}</h2>

      <p className={styles.credit}>
        <span>{entry.creator}</span>
        {yearLabel ? (
          <>
            <span aria-hidden="true" className={styles.dot}>
              ·
            </span>
            <span>{yearLabel}</span>
          </>
        ) : null}
        <span aria-hidden="true" className={styles.dot}>
          ·
        </span>
        <span>{entry.region}</span>
      </p>

      <p className={styles.logline}>{entry.logline}</p>
    </Link>
  );
}
