import styles from "./ArchiveContribute.module.css";

const MAILTO = `mailto:concierge@thereflectivefootball.com?subject=${encodeURIComponent(
  "Archive suggestion",
)}`;

export default function ArchiveContribute({ children = null }) {
  return (
    <section
      className={styles.block}
      aria-labelledby="archive-contribute-heading"
    >
      <div className={styles.inner}>
        {children ? <div className={styles.lead}>{children}</div> : null}
        <h2 id="archive-contribute-heading" className={styles.heading}>
          Missed something?
        </h2>
        <p className={styles.body}>
          Tell us what belongs here. A title, who made it, and where you found
          it.
        </p>
        <p className={styles.body}>
          <a href={MAILTO} className={styles.link}>
            Email the archive
          </a>
        </p>
      </div>
    </section>
  );
}
