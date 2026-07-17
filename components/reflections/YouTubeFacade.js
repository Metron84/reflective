"use client";

import { useState } from "react";
import AwardsLaurelCover from "@/components/covers/AwardsLaurelCover";

// Lazy YouTube embed: thumbnail + play button until clicked, then the
// real iframe. Keeps the page fast with many nominees.
export default function YouTubeFacade({ youtubeId, title, startSeconds = 0 }) {
  const [playing, setPlaying] = useState(false);
  const start =
    Number.isFinite(Number(startSeconds)) && Number(startSeconds) > 0
      ? Math.floor(Number(startSeconds))
      : 0;

  if (!youtubeId) {
    return (
      <div className="relative aspect-video w-full overflow-hidden">
        <AwardsLaurelCover />
      </div>
    );
  }

  if (playing) {
    return (
      <iframe
        className="aspect-video w-full"
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1${start ? `&start=${start}` : ""}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group relative block aspect-video w-full"
      aria-label={`Play ${title}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`}
        alt={title}
        loading="lazy"
        className="h-full w-full object-cover"
      />
      <span className="absolute inset-0 flex items-center justify-center bg-navy/30 transition-colors group-hover:bg-navy/10">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-signal text-paper">
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-6 w-6">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  );
}
