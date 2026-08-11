import { ARCHIVE_MEDIUM_TAGS } from "@/lib/archive/labels";
import styles from "./ArchiveVisual.module.css";

const LAYOUTS = ["topLeft", "centred", "bottomLeft"];
const LONG_TITLE_CHARS = 40;

function layoutFromId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return LAYOUTS[(hash >>> 0) % 3];
}

export default function ArchiveVisual({ entry }) {
  const layout = layoutFromId(entry.id);
  const longTitle = entry.title.length > LONG_TITLE_CHARS;
  const yearLabel = entry.year == null ? null : String(entry.year);

  return (
    <header className={`${styles.frame} ${styles[layout]}`}>
      <p className={styles.medium}>{ARCHIVE_MEDIUM_TAGS[entry.medium]}</p>
      <div className={styles.cluster}>
        <h1 className={longTitle ? styles.titleLong : styles.title}>
          {entry.title}
        </h1>
        <hr className={styles.rule} />
        <p className={styles.creator}>{entry.creator}</p>
      </div>
      {yearLabel ? <p className={styles.year}>{yearLabel}</p> : null}
    </header>
  );
}
