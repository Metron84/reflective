import fs from "fs";
import path from "path";

const MANIFEST_PATH = path.join(process.cwd(), "content/games.json");

export function normalizeGame(raw) {
  return {
    slug: raw.slug,
    title: raw.title,
    hook: raw.hook ?? "",
    status: raw.status,
    href: raw.href ?? null,
    cover: raw.cover ?? null,
    statusLabel: raw.statusLabel ?? null,
  };
}

export function getGames() {
  const raw = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const list = Array.isArray(raw) ? raw : raw.games;
  return list.map(normalizeGame);
}
