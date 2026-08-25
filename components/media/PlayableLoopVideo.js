"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./PlayableLoopVideo.module.css";

function MuteIcon({ muted }) {
  if (muted) {
    return (
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M5 9v6h4l5 5V4L9 9H5zm11.5 3 2.1-2.1 1.4 1.4L17.9 13.4l2.1 2.1-1.4 1.4L16.5 14.8l-2.1 2.1-1.4-1.4 2.1-2.1-2.1-2.1 1.4-1.4 2.1 2.1z"
        />
      </svg>
    );
  }

  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 9v6h4l5 5V4L9 9H5zm11.66 0.17a4 4 0 0 1 0 5.66l1.41 1.41a6 6 0 0 0 0-8.48l-1.41 1.41zm2.83-2.83a8 8 0 0 1 0 11.32l1.41 1.41a10 10 0 0 0 0-14.14l-1.41 1.41z"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

/**
 * Shared loop video with a play control that hides once playing.
 * Case study: startWithSound plays unmuted on the user tap.
 */
export default function PlayableLoopVideo({
  src,
  poster,
  label = "Video",
  variant = "hero",
  preload = "metadata",
  preferAutoplay = true,
  startWithSound = false,
}) {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(!startWithSound);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const sync = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onPlaying = () => setPlaying(true);
    const onPause = () => {
      if (el.ended) return;
      setPlaying(false);
    };

    el.addEventListener("playing", onPlaying);
    el.addEventListener("pause", onPause);

    if (reducedMotion || !preferAutoplay) {
      el.pause();
      setPlaying(false);
      return () => {
        el.removeEventListener("playing", onPlaying);
        el.removeEventListener("pause", onPause);
      };
    }

    // Autoplay must be muted.
    el.muted = true;
    el.defaultMuted = true;
    setMuted(true);
    const attempt = el.play();
    if (attempt?.then) {
      attempt
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }

    return () => {
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("pause", onPause);
    };
  }, [reducedMotion, src, preferAutoplay]);

  function toggleMute(event) {
    event.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    const next = !el.muted;
    el.muted = next;
    el.volume = next ? 0 : 1;
    setMuted(next);
  }

  function playFromPoster(event) {
    event.stopPropagation();
    const el = videoRef.current;
    if (!el) return;

    el.volume = 1;
    if (startWithSound) {
      el.muted = false;
      el.defaultMuted = false;
      setMuted(false);
    } else {
      el.muted = true;
      el.defaultMuted = true;
      setMuted(true);
    }

    const attempt = el.play();
    if (!attempt?.then) {
      setPlaying(true);
      return;
    }

    attempt
      .then(() => {
        if (startWithSound) {
          el.muted = false;
          el.volume = 1;
          setMuted(false);
        }
        setPlaying(true);
      })
      .catch(() => {
        // Last resort: play muted so the picture still starts.
        el.muted = true;
        setMuted(true);
        el.play()
          ?.then(() => setPlaying(true))
          .catch(() => setPlaying(false));
      });
  }

  const frameClass =
    variant === "syllabus"
      ? `${styles.frame} ${styles.syllabus}`
      : variant === "case"
        ? `${styles.frame} ${styles.caseStudy}`
        : styles.frame;

  const videoClass =
    variant === "syllabus"
      ? `${styles.video} ${styles.syllabusVideo}`
      : variant === "case"
        ? `${styles.video} ${styles.caseVideo}`
        : styles.video;

  // Avoid a controlled `muted` attribute fighting imperative unmute on case study.
  const videoMutedProps = startWithSound
    ? {}
    : { muted: true, defaultMuted: true };

  return (
    <div className={frameClass}>
      <video
        key={src}
        ref={videoRef}
        className={videoClass}
        poster={poster}
        preload={preload}
        playsInline
        loop
        autoPlay={preferAutoplay && !reducedMotion && !startWithSound}
        aria-label={label}
        {...videoMutedProps}
      >
        <source src={src} type="video/mp4" />
      </video>

      {!playing ? (
        <button
          type="button"
          className={`${styles.control} ${styles.playControl}`}
          onClick={playFromPoster}
          aria-label={`Play ${label}`}
        >
          <PlayIcon />
        </button>
      ) : (
        <button
          type="button"
          className={styles.control}
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          aria-pressed={!muted}
        >
          <MuteIcon muted={muted} />
        </button>
      )}
    </div>
  );
}
