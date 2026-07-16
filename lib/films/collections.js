import fs from "fs";
import path from "path";

const COLLECTIONS_PATH = path.join(process.cwd(), "content/collections.json");

export function getCollectionsManifest() {
  if (!fs.existsSync(COLLECTIONS_PATH)) return { collections: [] };
  return JSON.parse(fs.readFileSync(COLLECTIONS_PATH, "utf8"));
}

export function collectionDisplayTitle(entry) {
  if (entry.titleOverride?.trim()) return entry.titleOverride.trim();
  return entry.title ?? "";
}

/** Visible collections enriched with member count and cover thumb. */
export function getVisibleCollections(films) {
  const { collections } = getCollectionsManifest();

  return collections
    .filter((entry) => entry.visible)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((entry) => {
      const members = films.filter((film) =>
        (film.playlists ?? []).some((pl) => pl.id === entry.playlistId)
      );
      members.sort((a, b) =>
        String(b.published_at ?? "").localeCompare(String(a.published_at ?? ""))
      );
      const first = members[0];
      return {
        playlistId: entry.playlistId,
        title: entry.title,
        titleOverride: entry.titleOverride ?? null,
        displayTitle: collectionDisplayTitle(entry),
        sort: entry.sort ?? 0,
        count: members.length,
        thumbnailVideoId: first?.youtube_id ?? null,
      };
    })
    .filter((entry) => entry.count > 0);
}
