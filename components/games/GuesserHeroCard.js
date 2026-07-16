import Link from "next/link";
import GameCoverBySlug from "@/components/covers/GameCoverBySlug";
import { GUESSER_STRAPLINE } from "@/lib/config";
import styles from "./GuesserHeroCard.module.css";

export default function GuesserHeroCard({ game }) {
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
        <p className={styles.strapline}>{GUESSER_STRAPLINE}</p>
        <p className={styles.hook}>{game.hook}</p>
        <span className={styles.play}>Play</span>
      </div>
    </Link>
  );
}
