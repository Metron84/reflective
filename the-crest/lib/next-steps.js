const TRF_HOME = "/games";

/**
 * @param {{ trf_film_youtube_id?: string|null; uae?: { supporters_club?: string|null }|null }} club
 */
export function nextStepsForClub(club) {
  if (club.trf_film_youtube_id) {
    return {
      label: "Watch the TRF film",
      href: `https://www.youtube.com/watch?v=${club.trf_film_youtube_id}`,
    };
  }
  if (club.uae?.supporters_club) {
    return {
      label: "Join the supporters group in the UAE",
      href: club.uae.supporters_club,
    };
  }
  return {
    label: "Explore The Reflective Football",
    href: TRF_HOME,
  };
}
