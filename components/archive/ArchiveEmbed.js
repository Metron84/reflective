"use client";

import { useState } from "react";
import ArchiveVisual from "./ArchiveVisual";
import styles from "./ArchiveEmbed.module.css";

const LABELS = {
  youtube: "Play trailer",
  spotify: "Listen",
};

function embedSrc(provider, id) {
  const safe = String(id).replace(/[^A-Za-z0-9_/-]/g, "");
  if (!safe) return null;
  if (provider === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${safe}?autoplay=1`;
  }
  if (provider === "spotify") {
    return `https://open.spotify.com/embed/${safe}?theme=0`;
  }
  return null;
}

export default function ArchiveEmbed({ entry }) {
  const [playing, setPlaying] = useState(false);
  const embed = entry?.embed;
  if (!embed) return null;

  const label = LABELS[embed.provider];
  if (!label) return null;

  const src = playing ? embedSrc(embed.provider, embed.id) : null;

  if (playing && src) {
    return (
      <div className={styles.player}>
        <h1 className={styles.srOnly}>{entry.title}</h1>
        <iframe
          src={src}
          title={entry.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className={styles.facade}>
      <ArchiveVisual entry={entry} />
      <button
        type="button"
        className={styles.play}
        onClick={() => setPlaying(true)}
        aria-label={`${label}: ${entry.title}`}
      >
        <span className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <span>{label}</span>
      </button>
    </div>
  );
}
