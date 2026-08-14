import styles from "./RouteSkeleton.module.css";

/**
 * Static cream route skeletons — no fetch, opacity pulse only.
 * @param {{ variant: "films" | "games" | "codemaster" | "reflections" | "ultima" }} props
 */
export default function RouteSkeleton({ variant }) {
  return (
    <div
      className={`${styles.shell} ${styles[variant]}`}
      style={{ background: "#F2EDE4" }}
      aria-busy="true"
      aria-live="polite"
    >
      {variant === "films" ? <FilmsFold /> : null}
      {variant === "games" ? <GamesFold /> : null}
      {variant === "codemaster" ? <CodemasterFold /> : null}
      {variant === "reflections" ? <ReflectionsFold /> : null}
      {variant === "ultima" ? <UltimaFold /> : null}
      <span className={styles.sr}>Loading</span>
    </div>
  );
}

function FilmsFold() {
  return (
    <div className={styles.filmsFold}>
      <div className={`${styles.block} ${styles.pulse} ${styles.filmsCrest}`} />
      <div className={`${styles.block} ${styles.pulse} ${styles.filmsTitle}`} />
      <div className={`${styles.block} ${styles.pulse} ${styles.filmsPlaque}`} />
      <div className={styles.filmsChips}>
        <div className={`${styles.block} ${styles.pulse} ${styles.chip}`} />
        <div className={`${styles.block} ${styles.pulse} ${styles.chip}`} />
        <div className={`${styles.block} ${styles.pulse} ${styles.chip}`} />
      </div>
    </div>
  );
}

function GamesFold() {
  return (
    <div className={styles.gamesFold}>
      <div className={`${styles.block} ${styles.pulse} ${styles.gamesEyebrow}`} />
      <div className={`${styles.block} ${styles.pulse} ${styles.gamesTitle}`} />
      <div className={`${styles.block} ${styles.pulse} ${styles.gamesCard}`} />
    </div>
  );
}

function CodemasterFold() {
  return (
    <div className={styles.codemasterFold}>
      <div
        className={`${styles.block} ${styles.pulse} ${styles.codemasterEyebrow}`}
      />
      <div
        className={`${styles.block} ${styles.pulse} ${styles.codemasterTitle}`}
      />
      <div
        className={`${styles.block} ${styles.pulse} ${styles.codemasterLede}`}
      />
      <div
        className={`${styles.block} ${styles.pulse} ${styles.codemasterRank}`}
      />
    </div>
  );
}

function ReflectionsFold() {
  return (
    <div className={styles.reflectionsFold}>
      <div
        className={`${styles.block} ${styles.pulse} ${styles.reflectionsEyebrow}`}
      />
      <div
        className={`${styles.block} ${styles.pulse} ${styles.reflectionsTitle}`}
      />
      <div
        className={`${styles.block} ${styles.pulse} ${styles.reflectionsLede}`}
      />
      <div
        className={`${styles.block} ${styles.pulse} ${styles.reflectionsCta}`}
      />
    </div>
  );
}

function UltimaFold() {
  return (
    <div className={styles.ultimaFold}>
      <div className={`${styles.block} ${styles.pulse} ${styles.ultimaEyebrow}`} />
      <div className={`${styles.block} ${styles.pulse} ${styles.ultimaTitle}`} />
      <div className={`${styles.block} ${styles.pulse} ${styles.ultimaDoor}`} />
      <div className={`${styles.block} ${styles.pulse} ${styles.ultimaDoor}`} />
    </div>
  );
}
