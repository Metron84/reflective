import Link from "next/link";
import GameCoverBySlug from "@/components/covers/GameCoverBySlug";
import styles from "./GuesserHeroCard.module.css";

export default function LiveGameCard({ game, strapline }) {
  return (
    <Link href={game.href} className={styles.card}>
      <div className={styles.cover}>
        {game.cover ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={game.cover}
            alt=""
            loading="eager"
            className={styles.coverImage}
          />
        ) : (
          <GameCoverBySlug slug={game.slug} />
        )}
        <div className={styles.coverScrim} aria-hidden />
      </div>
      <div className={styles.body}>
        <h2 className={styles.title}>{game.title}</h2>
        {strapline ? <p className={styles.strapline}>{strapline}</p> : null}
        <p className={styles.hook}>{game.hook}</p>
        {game.statusLabel ? (
          <p className={styles.strapline}>{game.statusLabel}</p>
        ) : null}
        <span className={styles.play}>Play</span>
      </div>
    </Link>
  );
}
