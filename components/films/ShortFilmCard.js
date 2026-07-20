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

/** YouTube's missing oardefault is a tiny 120×90 grey JPEG that often still "loads". */
function isPlaceholderThumb(img) {
  if (!img?.naturalWidth) return true;
  return img.naturalWidth <= 120 && img.naturalHeight <= 90;
}

export default function ShortFilmCard({ film }) {
  const landscape = youtubeThumbnailUrl(film.youtube_id);
  const vertical = youtubeVerticalThumbnailUrl(film.youtube_id);
  const [thumbSrc, setThumbSrc] = useState(() => vertical ?? landscape);
  const watchUrl = youtubeWatchUrl(film.youtube_id);
  const showStory = !isSampleStory(film.story);
  const clubs = film.clubs ?? [];

  function useLandscapeFallback() {
    if (landscape && thumbSrc !== landscape) {
      setThumbSrc(landscape);
    }
  }

  function handleThumbError() {
    useLandscapeFallback();
  }

  function handleThumbLoad(event) {
    if (thumbSrc === vertical && isPlaceholderThumb(event.currentTarget)) {
      useLandscapeFallback();
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
              onLoad={handleThumbLoad}
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
