import GameCoverBySlug from "@/components/covers/GameCoverBySlug";
import styles from "./ComingSoonGameCard.module.css";

export default function ComingSoonGameCard({ game }) {
  return (
    <div className={styles.card}>
      <div className={styles.cover} aria-hidden>
        {game.cover ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={game.cover} alt="" loading="lazy" className={styles.coverImage} />
        ) : (
          <GameCoverBySlug slug={game.slug} />
        )}
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{game.title}</h3>
        <p className={styles.hook}>{game.hook}</p>
        <p className={styles.status}>{game.statusLabel}</p>
      </div>
    </div>
  );
}
