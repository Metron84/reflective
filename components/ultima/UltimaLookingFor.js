import Link from "next/link";
import { ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";
import UltimaCountryTag from "./UltimaCountryTag";
import styles from "./ultima.module.css";

/**
 * "Looking for ENG ESP · a striker who plays every week".
 * Shown on the squad header and on the trade block. `editHref` adds an Edit link.
 */
export default function UltimaLookingFor({ leagues = [], note = "", editHref = null, solo = false }) {
  const tags = (leagues ?? []).filter((l) => ULTIMA_LEAGUE_SHORT[l]);
  const text = String(note ?? "").trim();
  if (!tags.length && !text && !editHref) return null;
  const empty = !tags.length && !text;
  return (
    <p className={solo ? `${styles.lookLine} ${styles.lookLineSolo}` : styles.lookLine}>
      <span className={styles.blkLookingLabel}>Looking for</span>
      {empty ? (
        <span>Nothing set</span>
      ) : (
        <>
          {tags.length ? (
            <span className={styles.lookTags}>
              {tags.map((league) => (
                <UltimaCountryTag key={league} league={league} />
              ))}
            </span>
          ) : null}
          {text ? <span>{text}</span> : null}
        </>
      )}
      {editHref ? (
        <Link className={styles.lookEdit} href={editHref} prefetch={false}>
          Edit
        </Link>
      ) : null}
    </p>
  );
}
