"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./HeroPromoVideo.module.css";

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

export default function HeroPromoVideo({ src = "/promo/promo.mp4" }) {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = mq.matches;
    setReducedMotion(reduced);

    const sync = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    el.muted = true;

    if (reducedMotion) {
      el.pause();
      setPlaying(false);
      return;
    }

    const attempt = el.play();
    if (attempt?.then) {
      attempt
        .then(() => setPlaying(true))
        .catch((err) => {
          setPlaying(false);
          if (process.env.NODE_ENV !== "production") {
            console.warn("[TRF] Hero promo play() failed:", err?.name, err?.message);
          }
        });
    }
  }, [reducedMotion, src]);

  function toggleMute(event) {
    event.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }

  function playFromPoster() {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    setMuted(true);
    const attempt = el.play();
    if (attempt?.then) {
      attempt
        .then(() => setPlaying(true))
        .catch((err) => {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[TRF] Hero promo play() failed:", err?.name, err?.message);
          }
        });
    }
  }

  return (
    <div className={styles.frame}>
      <video
        ref={videoRef}
        className={styles.video}
        poster="/promo/promo-poster.jpg"
        preload="auto"
        playsInline
        loop
        muted
        autoPlay
        aria-label="The Reflective Football promo"
      >
        <source src={src} type="video/mp4" />
      </video>

      {reducedMotion && !playing ? (
        <button
          type="button"
          className={styles.control}
          onClick={playFromPoster}
          aria-label="Play promo"
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
