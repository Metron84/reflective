"use client";

import { useState } from "react";
import { SAMPLE_STORY, youtubeWatchUrl } from "@/lib/films/schema";
import {
  youtubeThumbnailUrl,
  youtubeVerticalThumbnailUrl,
} from "@/lib/films/youtube";
import styles from "./ShortFilmCard.module.css";

function isSampleStory(story) {
  if (!story?.trim()) return true;
  return story.trim().startsWith("SAMPLE:");
}

export default function ShortFilmCard({ film }) {
  const [thumbSrc, setThumbSrc] = useState(
    () =>
      youtubeVerticalThumbnailUrl(film.youtube_id) ??
      youtubeThumbnailUrl(film.youtube_id)
  );
  const watchUrl = youtubeWatchUrl(film.youtube_id);
  const showStory = !isSampleStory(film.story);
  const clubs = film.clubs ?? [];

  function handleThumbError() {
    const fallback = youtubeThumbnailUrl(film.youtube_id);
    if (fallback && thumbSrc !== fallback) {
      setThumbSrc(fallback);
    }
  }

  return (
    <article className={styles.card}>
      <a
        href={watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.link}
      >
        <div className={styles.thumbWrap}>
          {thumbSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={thumbSrc}
              alt=""
              loading="lazy"
              decoding="async"
              className={styles.thumb}
              onError={handleThumbError}
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
          {film.venue ? <p className={styles.venue}>{film.venue}</p> : null}
          {showStory ? <p className={styles.story}>{film.story}</p> : null}
          <span className={styles.watch}>Watch</span>
        </div>
      </a>
    </article>
  );
}
