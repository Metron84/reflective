import { getThinkersForEntry } from "@/lib/archive/thinkers";
import lens from "./ArchiveLens.module.css";
import styles from "./ArchiveThinkers.module.css";

type ArchiveThinkersProps = {
  entryId: string;
};

/** Up to three thinkers from different fields, each with the question they would ask and where their reading breaks. */
export default function ArchiveThinkers({ entryId }: ArchiveThinkersProps) {
  const record = getThinkersForEntry(entryId);
  if (!record || (!record.maker && record.thinkers.length === 0)) return null;

  return (
    <aside className={lens.block} aria-label="Thinker lens">
      <p className={lens.voice}>Through the thinkers</p>
      {record.maker ? (
        <div className={styles.maker}>
          <p className={styles.name}>
            {record.maker.name} <span className={styles.domain}>made this</span>
          </p>
          <p className={styles.line}>{record.maker.question}</p>
        </div>
      ) : null}
      {record.thinkers.map((t, index) => (
        <div key={t.id}>
          {index > 0 || record.maker ? <hr className={lens.rule} /> : null}
          <p className={styles.name}>
            {t.name} <span className={styles.domain}>{t.domain}</span>
          </p>
          <p className={lens.text}>{t.question}</p>
          <p className={styles.breaks}>
            <span className={styles.label}>Where this reading breaks: </span>
            {t.breaks}
          </p>
        </div>
      ))}
      <p className={lens.disclaimer}>
        Built from each thinker&apos;s documented way of reasoning. Interpretations, not quotations.
      </p>
    </aside>
  );
}
