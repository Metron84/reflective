// SERVER ONLY. Answers are derived here and must never be serialised to a client while a round is live.
import { getAllRows, getPerson } from "@/lib/guesser/registry";
import { contextLine, normalize } from "@/lib/guesser/matching";
import { GUESSER_EPOCH } from "@/lib/guesser/config";
import { BOARD_SIZE, boardForDay, buildOrder } from "./schedule";
import { CLUE_COUNT } from "./engine";

/**
 * People kept out of the daily pool until their clues are rewritten. See docs/guesser-clue-rewrites.md.
 * Each has a nickname or name in a clue, or a clue too short to be one.
 */
export const EXCLUDED_PERSON_IDS = [
  "gabriel-batistuta",
  "carles-puyol",
  "mario-gotze",
  "manuel-neuer",
  "tony-adams",
  "fernando-torres",
  "mohamed-salah",
  "david-silva",
  "bukayo-saka",
  "isco",
  "paulo-dybala",
  "giorgio-chiellini",
  "khvicha-kvaratskhelia",
  "giuseppe-bergomi",
  "lukas-podolski",
  "jamal-musiala",
  "thiago-alcantara",
  "ailton",
  "thiago-silva",
  "pauleta",
  "youri-djorkaeff",
  "nabil-fekir",
  "steve-mandanda",
  "jean-pierre-papin",
  "ashley-cole",
];

const MIN_CLUE_CHARS = 25;

let poolCache = null;
let orderCache = null;
let indexCache = null;

/**
 * People who can appear on a daily board: four real clues (the existing clues 1 to 4), no
 * "SAMPLE:" placeholder text, and not on the exclusion list.
 * @returns {{personId: string, name: string, league: string, clues: string[]}[]}
 */
export function getBuzzerPool() {
  if (poolCache) return poolCache;
  const excluded = new Set(EXCLUDED_PERSON_IDS);
  poolCache = getAllRows()
    .filter((row) => row.canonical && !excluded.has(row.person_id))
    .filter((row) => {
      const clues = row.clues ?? [];
      if (clues.some((c) => String(c).trim().toUpperCase().startsWith("SAMPLE"))) return false;
      const four = clues.slice(0, CLUE_COUNT);
      return four.length === CLUE_COUNT && four.every((c) => String(c).trim().length >= MIN_CLUE_CHARS);
    })
    .map((row) => ({
      personId: row.person_id,
      name: row.name,
      league: row.category,
      clues: row.clues.slice(0, CLUE_COUNT).map((c) => String(c).trim()),
    }));
  return poolCache;
}

/** The fixed cyclic order of person ids that the daily boards walk through. */
export function getBuzzerOrder() {
  if (orderCache) return orderCache;
  const pool = getBuzzerPool();
  const league = new Map(pool.map((p) => [p.personId, p.league]));
  orderCache = buildOrder(
    pool.map((p) => p.personId),
    (id) => league.get(id),
  );
  return orderCache;
}

/** Whole days from the Guesser epoch to a yyyy-mm-dd Dubai day. */
export function dayIndexOf(day) {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${GUESSER_EPOCH}T00:00:00Z`)) / 86400000);
}

/** The scheduled 5 person ids for a Dubai day, in play order. */
export function scheduledBoardIds(day) {
  return boardForDay(getBuzzerOrder(), Math.max(0, dayIndexOf(day)));
}

/** Clues 1 to 4 for a person. Server only. */
export function cluesFor(personId) {
  return getPerson(personId)?.clues?.slice(0, CLUE_COUNT) ?? [];
}

export function nameFor(personId) {
  return getPerson(personId)?.name ?? "";
}

/** True when this person belongs to World Cup Legends (any of their rows). */
export function isWorldCupPerson(personId) {
  const person = getPerson(personId);
  return Boolean(person?.rows?.some((r) => r.category === "world_cup"));
}

/**
 * The autocomplete list: all people, not only the pool, so the list never hints at who can appear.
 * Compact tuples keep the payload small: [personId, name, aliases, context].
 */
export function getAutocompleteList() {
  return getAllRows()
    .filter((row) => row.canonical)
    .map((row) => [row.person_id, row.name, row.aliases ?? [], contextLine(row)]);
}

function buildNameIndex() {
  if (indexCache) return indexCache;
  const index = new Map();
  const add = (key, personId) => {
    if (!key) return;
    if (!index.has(key)) index.set(key, new Set());
    index.get(key).add(personId);
  };
  for (const row of getAllRows()) {
    if (!row.canonical) continue;
    const full = normalize(row.name);
    add(full, row.person_id);
    for (const alias of row.aliases ?? []) add(normalize(alias), row.person_id);
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length > 1) add(parts.at(-1), row.person_id); // surname
  }
  indexCache = index;
  return index;
}

/**
 * Turn typed text into a person. Full name, alias or surname. A surname shared by two people
 * (the two Silvas) is "ambiguous" and the player is asked to pick from the list.
 *
 * @returns {{type: "one", personId: string}|{type: "ambiguous", options: string[]}|{type: "none"}}
 */
export function resolveGuessText(text) {
  const key = normalize(text);
  const hit = key ? buildNameIndex().get(key) : null;
  if (!hit || hit.size === 0) return { type: "none" };
  if (hit.size === 1) return { type: "one", personId: [...hit][0] };
  return { type: "ambiguous", options: [...hit].slice(0, 6) };
}

export { BOARD_SIZE };
