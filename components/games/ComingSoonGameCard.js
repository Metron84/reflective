import Link from "next/link";
import GameCoverBySlug from "@/components/covers/GameCoverBySlug";
import styles from "./ComingSoonGameCard.module.css";

export default function ComingSoonGameCard({ game }) {
  const inner = (
    <>
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
    </>
  );

  if (game.href) {
    return (
      <Link href={game.href} className={styles.card}>
        {inner}
      </Link>
    );
  }

  return <div className={styles.card}>{inner}</div>;
}
