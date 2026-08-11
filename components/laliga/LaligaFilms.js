import { youtubeThumbnailUrl } from "@/lib/films/youtube";
import { LALIGA_FILMS } from "@/lib/laliga/films";
import styles from "./LaligaFilms.module.css";

export default function LaligaFilms() {
  return (
    <section className={styles.section} aria-labelledby="laliga-films-heading">
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>THE FILMS</p>
          <h2 id="laliga-films-heading" className={styles.headline}>
            Watch while we build the nights.
          </h2>
        </header>

        <ul className={styles.list}>
          {LALIGA_FILMS.map((film) => {
            const thumb = youtubeThumbnailUrl(film.youtubeId);
            return (
              <li key={film.youtubeId}>
                <a
                  href={film.href}
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
