import {
  ARCHIVE_LENS_VOICE_LABELS,
  getLensesForEntry,
  type ArchiveLensVoice,
} from "@/lib/archive/lenses";
import styles from "./ArchiveLens.module.css";

const VOICE_ORDER: ArchiveLensVoice[] = [
  "historian",
  "psychologist",
  "sceptic",
];

type ArchiveLensProps = {
  entryId: string;
};

export default function ArchiveLens({ entryId }: ArchiveLensProps) {
  const lenses = getLensesForEntry(entryId);
  if (lenses.length === 0) return null;

  const ordered = VOICE_ORDER.map((voice) =>
    lenses.find((lens) => lens.voice === voice),
  ).filter(Boolean) as { voice: ArchiveLensVoice; text: string }[];

  const passages = ordered.slice(0, 3);
  if (passages.length === 0) return null;

  return (
    <aside className={styles.block} aria-label="Archive lenses">
      {passages.map((passage, index) => (
        <div key={passage.voice}>
          {index > 0 ? <hr className={styles.rule} /> : null}
          <p className={styles.voice}>
            {ARCHIVE_LENS_VOICE_LABELS[passage.voice]}
          </p>
          <p className={styles.text}>{passage.text}</p>
        </div>
      ))}
      <p className={styles.disclaimer}>
        These are interpretations written in three voices, not quotations from
        any individual.
      </p>
    </aside>
  );
}
