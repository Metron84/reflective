// YouTube still thumbnails — no API key required.
export function youtubeThumbnailUrl(youtubeId, quality = "hqdefault") {
  if (!youtubeId) return null;
  return `https://i.ytimg.com/vi/${youtubeId}/${quality}.jpg`;
}

/** Vertical (9:16) thumb for Shorts — oardefault when YouTube has it. */
export function youtubeVerticalThumbnailUrl(youtubeId) {
  if (!youtubeId) return null;
  return `https://i.ytimg.com/vi/${youtubeId}/oardefault.jpg`;
}
