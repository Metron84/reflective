import Image from "next/image";
import Link from "next/link";
import styles from "./ReflectivesHero.module.css";

export default function ReflectivesHero({ votingState, isSignedIn }) {
  return (
    <section className={styles.hero} aria-labelledby="reflectives-hero-title">
      <div className={styles.bg} aria-hidden>
        <Image
          src="/reflections/hero-still.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.bgImage}
        />
        <div className={styles.veil} />
      </div>

      <div className={styles.inner}>
        <p className={styles.eyebrow}>Awards. For the Fans.</p>
        <h1 id="reflectives-hero-title" className={styles.title}>
          The Reflectives
        </h1>
        <p className={styles.lede}>
          Eight awards for the fans of the summer. Watch the nominees. Sign up
          free to vote.
        </p>
        {votingState === "open" ? (
          isSignedIn ? (
            <a href="#best-video" className={styles.cta}>
              Cast your votes
            </a>
          ) : (
            <Link href="/signin?next=/reflections" className={styles.cta}>
              Sign up free to vote
            </Link>
          )
        ) : votingState === "before" ? (
          <p className={styles.status}>Voting opens soon.</p>
        ) : (
          <p className={styles.status}>Voting is closed.</p>
        )}
      </div>
    </section>
  );
}
