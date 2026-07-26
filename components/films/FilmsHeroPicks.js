import { youtubeWatchUrl } from "@/lib/films/schema";
import { youtubeThumbnailUrl } from "@/lib/films/youtube";
import { FILMS_HERO_PICKS, FILMS_HERO_PICKS_ID } from "@/lib/films/hero";
import styles from "./FilmsHeroPicks.module.css";

export default function FilmsHeroPicks() {
  return (
    <section
      id={FILMS_HERO_PICKS_ID}
      className={styles.section}
      aria-labelledby="films-hero-picks-heading"
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Three from the run</p>
          <h2 id="films-hero-picks-heading" className={styles.lede}>
            Where fans keep watching.
          </h2>
        </header>

        <ul className={styles.list}>
          {FILMS_HERO_PICKS.map((film) => {
            const thumb = youtubeThumbnailUrl(film.youtubeId);
            const href = youtubeWatchUrl(film.youtubeId);
            return (
              <li key={film.youtubeId}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.card}
                >
                  <div className={styles.thumb}>
                    {thumb ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={thumb}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className={styles.thumbImg}
                      />
                    ) : (
                      <div className={styles.thumbFallback} aria-hidden />
                    )}
                    <span className={styles.market}>{film.market}</span>
                    <span className={styles.play} aria-hidden>
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        width="22"
                        height="22"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </div>
                  <div className={styles.copy}>
                    <p className={styles.title}>{film.title}</p>
                    <p className={styles.label}>{film.label}</p>
                    <p className={styles.caption}>{film.caption}</p>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
