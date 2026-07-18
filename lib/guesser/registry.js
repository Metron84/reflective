import { readFileSync } from "fs";
import path from "path";
import { GUESSER_MODES, MIN_MODE_POOL_SIZE } from "./config";
import {
  normalize,
  matchKeysForPlayer,
  contextLine,
  filterSuggestionList,
} from "./matching";

let rowsCache;
let registryCache;

function loadRows() {
  if (!rowsCache) {
    const file = path.join(process.cwd(), "data", "players_seed.json");
    rowsCache = JSON.parse(readFileSync(file, "utf8")).players;
  }
  return rowsCache;
}

function buildRegistry() {
  if (registryCache) return registryCache;

  const rows = loadRows();
  const persons = new Map();

  for (const row of rows) {
    const personId = row.person_id;
    if (!personId) continue;
    if (!persons.has(personId)) {
      persons.set(personId, {
        personId,
        name: row.name,
        rows: [],
        canonical: null,
        clues: row.clues ?? [],
      });
    }
    const person = persons.get(personId);
    person.rows.push(row);
    if (row.canonical) {
      person.canonical = row;
      person.clues = row.clues ?? person.clues;
      person.name = row.name;
    }
  }

  for (const person of persons.values()) {
    if (!person.canonical) {
      person.canonical = person.rows[0];
      person.name = person.canonical.name;
    }
  }

  registryCache = { rows, persons };
  return registryCache;
}

export function getAllRows() {
  return loadRows();
}

export function getPerson(personId) {
  return buildRegistry().persons.get(personId) ?? null;
}

/** Compare row for this mode only (no cross-mode or canonical mixing). */
export function getCompareRow(mode, personId) {
  const person = getPerson(personId);
  if (!person) return null;
  return person.rows.find((r) => r.category === mode) ?? null;
}

/** All persons guessable in a mode (one entry per person with a row in that mode). */
export function getPersonsInMode(mode) {
  const { persons } = buildRegistry();
  const out = [];
  for (const person of persons.values()) {
    if (person.rows.some((r) => r.category === mode)) {
      out.push(person);
    }
  }
  return out;
}

/** Daily answer pool: persons with a compare row in this mode. */
export function getAnswerPersons(mode) {
  return getPersonsInMode(mode).filter((p) => getCompareRow(mode, p.personId));
}

export function getPool(mode) {
  return getPersonsInMode(mode);
}

export function getShippableModes() {
  return GUESSER_MODES.filter(
    (m) => getPersonsInMode(m.slug).length > MIN_MODE_POOL_SIZE
  );
}

export function getGuessSuggestions(mode) {
  return getPersonsInMode(mode).map((p) => ({
    personId: p.personId,
    name: p.name,
    context: contextLine(getCompareRow(mode, p.personId) ?? p.canonical),
  }));
}

export { filterSuggestionList };

function findPersonsByInput(mode, input) {
  const wanted = normalize(input);
  if (!wanted) return [];
  const matched = new Set();
  for (const row of loadRows()) {
    if (row.category !== mode) continue;
    if (matchKeysForPlayer(row).has(wanted)) {
      matched.add(row.person_id);
    }
  }
  return [...matched].map((id) => getPerson(id)).filter(Boolean);
}

export function resolveSubmission(mode, { guess, personId }) {
  if (personId) {
    const person = getPerson(personId);
    if (!person) return { type: "none" };
    const row = getCompareRow(mode, personId);
    if (!row) return { type: "none" };
    return { type: "single", person, row };
  }

  const persons = findPersonsByInput(mode, guess);
  if (!persons.length) return { type: "none" };
  if (persons.length === 1) {
    const person = persons[0];
    const row = getCompareRow(mode, person.personId);
    if (!row) return { type: "none" };
    return { type: "single", person, row };
  }

  return {
    type: "ambiguous",
    options: persons.map((person) => ({
      person,
      row: getCompareRow(mode, person.personId),
    })),
  };
}

export function resolvePersonById(personId) {
  return getPerson(personId);
}

export function getAnswerPayload(mode, personId) {
  const person = getPerson(personId);
  if (!person) return null;
  const row = getCompareRow(mode, personId);
  if (!row) return null;
  return {
    personId: person.personId,
    name: person.name,
    row,
    clues: person.clues,
  };
}
