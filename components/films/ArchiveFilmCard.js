import { SAMPLE_STORY, youtubeWatchUrl } from "@/lib/films/schema";
import { youtubeThumbnailUrl } from "@/lib/films/youtube";
import styles from "./ArchiveFilmCard.module.css";

function isSampleStory(story) {
  if (!story?.trim()) return true;
  return story.trim().startsWith("SAMPLE:");
}

export default function ArchiveFilmCard({ film, featured = false }) {
  const thumb = youtubeThumbnailUrl(film.youtube_id);
  const watchUrl = youtubeWatchUrl(film.youtube_id);
  const showStory = !isSampleStory(film.story);
  const clubs = film.clubs ?? [];

  return (
    <article
      className={`${styles.card} ${featured ? styles.featured : ""}`.trim()}
    >
      <a
        href={watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.link}
      >
        <div className={styles.thumbWrap}>
          {thumb ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={thumb}
              alt=""
              loading="lazy"
              decoding="async"
              className={styles.thumb}
            />
          ) : (
            <div className={styles.thumbFallback} aria-hidden />
          )}
          <div className={styles.thumbOverlay} aria-hidden />
        </div>
        <div className={styles.body}>
          <h2 className={styles.title}>{film.title}</h2>
          {clubs.length > 0 ? (
            <p className={styles.clubs}>{clubs.join(" · ")}</p>
          ) : null}
          {film.venue ? (
            <p className={styles.venue}>{film.venue}</p>
          ) : null}
          {showStory ? (
            <p className={styles.story}>{film.story}</p>
          ) : null}
          <span className={styles.watch}>Watch</span>
        </div>
      </a>
    </article>
  );
}
