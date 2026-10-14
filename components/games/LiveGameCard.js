import Link from "next/link";
import GameCoverBySlug from "@/components/covers/GameCoverBySlug";
import styles from "./GuesserHeroCard.module.css";

function isWideCover(slug) {
  return (
    slug === "ultima" ||
    slug === "are-you-really-a-fan" ||
    slug === "watch-with" ||
    slug === "the-crest" ||
    slug === "king-of-the-burgers"
  );
}

function isExternalHref(href) {
  return typeof href === "string" && /^https?:\/\//i.test(href);
}

export default function LiveGameCard({ game, strapline, action = "Play", wide = false }) {
  return (
    <Link
      href={game.href}
      className={styles.card}
      {...(isExternalHref(game.href)
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      <div className={wide || isWideCover(game.slug) ? styles.coverUltima : styles.cover}>
        {game.cover ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={game.cover}
            alt=""
            loading="eager"
            className={styles.coverImage}
            style={game.coverFocus ? { objectPosition: game.coverFocus } : undefined}
          />
        ) : (
          <GameCoverBySlug slug={game.slug} />
        )}
        {/* The Guesser art is flat navy, cream and red: a scrim would dull it. */}
        {game.slug === "the-guesser" ? null : <div className={styles.coverScrim} aria-hidden />}
      </div>
      <div className={styles.body}>
        <h2 className={styles.title}>{game.title}</h2>
        {strapline ? <p className={styles.strapline}>{strapline}</p> : null}
        <p className={styles.hook}>{game.hook}</p>
        {game.statusLabel ? (
          <p className={styles.strapline}>{game.statusLabel}</p>
        ) : null}
        <span className={styles.play}>{game.action ?? action}</span>
      </div>
    </Link>
  );
}
