import fs from "fs";
import path from "path";
import { STAND_ENABLED, ULTIMA_ENABLED } from "@/lib/config";

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
  // Parked games stay in the manifest for easy restore; hide from the site.
  // STAND_ENABLED overrides seed "parked" and forces live for The Stand.
  return list
    .map(normalizeGame)
    .map((game) => {
      if (game.slug === "the-stand") {
        if (!STAND_ENABLED) return null;
        return {
          ...game,
          status: "live",
          statusLabel: null,
        };
      }
      if (game.slug === "ultima") {
        if (!ULTIMA_ENABLED) return null;
        return {
          ...game,
          status: "live",
          statusLabel: "Invite only",
          cover: game.cover ?? "/ultima/ultima-card.png",
        };
      }
      return game;
    })
    .filter((game) => {
      if (!game) return false;
      if (game.slug === "the-stand") return true;
      return game.status !== "parked";
    });
}
