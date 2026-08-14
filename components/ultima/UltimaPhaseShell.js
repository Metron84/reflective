import Link from "next/link";
import styles from "@/components/ultima/ultima.module.css";

export default function UltimaPhaseShell({
  title,
  phase,
  lede,
  children,
  backHref = "/ultima",
}) {
  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>{title}</h1>
        {lede ? <p className={styles.lede}>{lede}</p> : null}
        {phase ? (
          <p className={styles.phaseNote}>
            Phase {phase} build in progress. Core schema and hub are live behind the feature flag.
          </p>
        ) : null}
        {children}
        <hr className={styles.rule} />
        <Link href={backHref} className={styles.quietLink}>
          Back to Ultima hub
        </Link>
      </div>
    </div>
  );
}
