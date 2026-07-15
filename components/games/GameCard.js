import Link from "next/link";
import styles from "./GameCard.module.css";

function Cover({ game, live }) {
  const coverClass = live ? styles.coverLive : styles.coverSoon;

  return (
    <div className={`${styles.cover} ${coverClass}`}>
      {game.cover ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={game.cover}
          alt=""
          loading="lazy"
          className={styles.coverImage}
        />
      ) : (
        <div className={styles.coverFallback} aria-hidden />
      )}
      <div className={styles.coverScrim} aria-hidden />
    </div>
  );
}

function CardBody({ game, live }) {
  return (
    <div className={live ? styles.bodyLive : styles.bodySoon}>
      <h2 className={styles.title}>{game.title}</h2>
      <p className={styles.hook}>{game.hook}</p>
      {live ? (
        <p className={styles.playAction}>Play</p>
      ) : (
        <p className={styles.statusLabel}>{game.statusLabel}</p>
      )}
    </div>
  );
}

export default function GameCard({ game }) {
  const live = game.status === "live";

  if (live && game.href) {
    return (
      <Link href={game.href} className={`${styles.card} ${styles.cardLive}`}>
        <Cover game={game} live />
        <CardBody game={game} live />
      </Link>
    );
  }

  return (
    <div className={`${styles.card} ${styles.cardSoon}`}>
      <Cover game={game} live={false} />
      <CardBody game={game} live={false} />
    </div>
  );
}
