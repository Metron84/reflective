/** YouTube id for We Are Football, Episode Zero. */
export const EPISODE_ZERO_ID = "HWyVL0RJOxs";

/** Branded Episode Zero still for Proof + Open Graph. */
export const EPISODE_ZERO_THUMB = "/training/episode-zero.jpg";

export function youtubeThumbMaxUrl(id = EPISODE_ZERO_ID) {
  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
}

export function youtubeWatchUrl(id = EPISODE_ZERO_ID) {
  return `https://www.youtube.com/watch?v=${id}`;
}
