const TRF_HOME = "https://thereflectivefootball.com";

/**
 * Locked routing lines. Missing items are skipped silently.
 * Order: film → UAE supporters → next fixture in a Dubai window.
 *
 * @param {{
 *   trf_film_youtube_id?: string|null;
 *   uae?: {
 *     supporters_club?: string|null;
 *     kickoff_window_gst?: string|null;
 *     next_fixture?: { date?: string; opponent?: string }|null;
 *   }|null;
 *   next_fixture?: { date?: string; opponent?: string }|null;
 * }} club
 * @returns {{ label: string; href: string|null }[]}
 */
export function routingStepsForClub(club) {
  /** @type {{ label: string; href: string|null }[]} */
  const steps = [];

  if (club.trf_film_youtube_id) {
    steps.push({
      label: "A film on how this club is followed.",
      href: `https://www.youtube.com/watch?v=${club.trf_film_youtube_id}`,
    });
  }

  const supporters = club.uae?.supporters_club;
  if (supporters && String(supporters).trim()) {
    const name = String(supporters).trim();
    const looksLikeUrl = /^https?:\/\//i.test(name);
    steps.push({
      label: looksLikeUrl
        ? "Supporters in the UAE."
        : `Supporters in the UAE: ${name}.`,
      href: looksLikeUrl ? name : null,
    });
  }

  const fixture = club.next_fixture ?? club.uae?.next_fixture ?? null;
  if (fixture?.date && fixture?.opponent) {
    steps.push({
      label: `Next match in a Dubai window: ${fixture.date}, ${fixture.opponent}.`,
      href: null,
    });
  } else if (club.uae?.kickoff_window_gst) {
    steps.push({
      label: `Next match in a Dubai window: typical kickoff ${club.uae.kickoff_window_gst}.`,
      href: null,
    });
  }

  if (!steps.length) {
    steps.push({
      label: "Explore The Reflective Football.",
      href: TRF_HOME,
    });
  }

  return steps;
}

/** @deprecated Use routingStepsForClub */
export function nextStepsForClub(club) {
  const steps = routingStepsForClub(club);
  return steps[0];
}
