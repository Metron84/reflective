"use client";

import PlayableLoopVideo from "@/components/media/PlayableLoopVideo";

/** Homepage hero promo — shared player with training syllabus. */
export default function HeroPromoVideo({ src = "/promo/promo.mp4" }) {
  return (
    <PlayableLoopVideo
      src={src}
      poster="/promo/promo-poster.jpg"
      label="The Reflective Football promo"
      variant="hero"
      preload="auto"
      preferAutoplay
    />
  );
}
