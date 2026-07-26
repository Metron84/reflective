import fs from "fs";
import path from "path";
import { gstDay } from "@/lib/guesser/config";

const STAND_DIR = path.join(process.cwd(), "data/stand");

export const QUESTIONS_PER_DAY = 5;
export const STAND_STORAGE_KEY = "trf_stand_v1";

export { gstDay };

export function getStandManifest() {
  return JSON.parse(fs.readFileSync(path.join(STAND_DIR, "manifest.json"), "utf8"));
}

export function getStandClubs() {
  return JSON.parse(fs.readFileSync(path.join(STAND_DIR, "clubs.json"), "utf8"));
}

export function getStandNations() {
  return JSON.parse(fs.readFileSync(path.join(STAND_DIR, "nations.json"), "utf8"));
}

export function listStandChapters() {
  const dir = path.join(STAND_DIR, "chapters");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

export function getStandChapter(id) {
  const file = path.join(STAND_DIR, "chapters", `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function resolveChapterForBadges(badges, activeBadge) {
  const clubId = badges?.clubId;
  const nationId = badges?.nationId;
  const personId = badges?.personId;

  if (activeBadge === "player" && personId) {
    const id = `player.${personId}.ch01`;
    if (getStandChapter(id)) return id;
  }
  if (activeBadge === "nation" && nationId) {
    const slug = nationId.replace(/^nation-/, "");
    const id = `na.${slug}.ch01`;
    if (getStandChapter(id)) return id;
  }
  if (activeBadge === "club" && clubId) {
    const clubs = getStandClubs();
    const club = clubs.find((c) => c.id === clubId);
    const league = club?.leagues?.[0];
    const prefix =
      league === "premier_league"
        ? "pl"
        : league === "serie_a"
          ? "sa"
          : league === "la_liga"
            ? "ll"
            : league === "bundesliga"
              ? "bl"
              : league === "ligue_1"
                ? "l1"
                : null;
    if (prefix) {
      const id = `${prefix}.${clubId}.ch01`;
      if (getStandChapter(id)) return id;
    }
  }

  // Fallbacks for the Melo pilot path
  if (clubId === "acf-fiorentina" && getStandChapter("sa.acf-fiorentina.ch01")) {
    return "sa.acf-fiorentina.ch01";
  }
  if (nationId === "nation-italy" && getStandChapter("na.italy.ch01")) {
    return "na.italy.ch01";
  }
  if (personId === "thierry-henry" && getStandChapter("player.thierry-henry.ch01")) {
    return "player.thierry-henry.ch01";
  }

  return getStandManifest().pilot_chapter || "sa.acf-fiorentina.ch01";
}

export function getClubOptionsForStand() {
  return getStandClubs()
    .filter((c) => c.stand_tier === "A" || c.stand_tier === "B")
    .map((c) => ({
      id: c.id,
      label: c.display_name,
      league: c.leagues[0] ?? null,
      tier: c.stand_tier,
    }));
}

export function getNationOptionsForStand() {
  return getStandNations()
    .filter((n) => n.stand_tier === "A" || n.stand_tier === "B" || n.stand_tier === "C")
    .map((n) => ({
      id: n.id,
      label: n.display_name,
      tier: n.stand_tier,
    }));
}

/** Player badge options that have a chapter pack */
export function getPlayerOptionsForStand() {
  const ids = listStandChapters()
    .filter((id) => id.startsWith("player."))
    .map((id) => id.replace(/^player\./, "").replace(/\.ch01$/, ""));
  const seed = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data/players_seed.json"), "utf8"),
  );
  const byId = new Map();
  for (const row of seed.players) {
    if (!byId.has(row.person_id)) byId.set(row.person_id, row.name);
  }
  return ids.map((id) => ({ id, label: byId.get(id) ?? id }));
}

export function chapterCatalog() {
  return listStandChapters()
    .map((id) => {
      const ch = getStandChapter(id);
      return {
        id,
        title: ch.title,
        lane: ch.lane,
        status: ch.status,
        entity: ch.primary_entity,
        generated: Boolean(ch.generated),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}
