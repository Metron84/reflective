// YouTube still thumbnails — no API key required.
export function youtubeThumbnailUrl(youtubeId, quality = "hqdefault") {
  if (!youtubeId) return null;
  return `https://i.ytimg.com/vi/${youtubeId}/${quality}.jpg`;
}
