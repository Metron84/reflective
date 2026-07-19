import { formatTimestamp } from "@/lib/concierge/formatTime";
import styles from "./MomentRow.module.css";

export default function MomentRow({ youtubeId, label, timestampSeconds }) {
  const t = Math.max(0, Math.floor(Number(timestampSeconds) || 0));
  const href = `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}&t=${t}s`;
  const time = formatTimestamp(t);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.row}
    >
      <span className={styles.cue} aria-hidden="true">
        ▸
      </span>
      <span className={styles.time}>{time}</span>
      <span className={styles.dash} aria-hidden="true">
        -
      </span>
      <span className={styles.label}>{label}</span>
    </a>
  );
}
