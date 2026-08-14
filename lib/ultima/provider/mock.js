import fs from "fs";
import path from "path";

const SEED_DIR = path.join(process.cwd(), "data/ultima/seed");

function readJson(name) {
  const file = path.join(SEED_DIR, name);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * @typedef {object} UltimaSeedPlayer
 * @property {string} provider_id
 * @property {string} name
 * @property {string} club
 * @property {'pl'|'laliga'|'seriea'} league
 * @property {boolean} [active]
 * @property {number} [goals_rate]
 * @property {number} [assists_rate]
 * @property {number} [rating_avg]
 * @property {number} [rating_consistency]
 * @property {number} [minutes_reliability]
 * @property {number} [club_strength]
 */

export class MockProvider {
  /** @type {UltimaSeedPlayer[]} */
  #players = [];

  /** @type {object[]} */
  #fixtures = [];

  /** @type {object} */
  #gwSample = null;

  /** @type {Record<string, string[]>} */
  #rankings = {};

  constructor() {
    this.#load();
  }

  #load() {
    for (const league of ["pl", "laliga", "seriea"]) {
      const rows = readJson(`players.${league}.json`);
      if (Array.isArray(rows)) {
        this.#players.push(...rows);
      }
    }
    const fixtures = readJson("fixtures.json");
    this.#fixtures = Array.isArray(fixtures) ? fixtures : [];
    this.#gwSample = readJson("stats.gw-sample.json");
    this.#rankings = readJson("rankings.json") ?? {};
  }

  getPlayers(league) {
    return this.#players.filter((p) => p.league === league && p.active !== false);
  }

  getAllPlayers() {
    return this.#players.filter((p) => p.active !== false);
  }

  getFixtures(league, from, to) {
    const fromMs = from ? new Date(from).getTime() : 0;
    const toMs = to ? new Date(to).getTime() : Number.MAX_SAFE_INTEGER;
    return this.#fixtures.filter((f) => {
      if (f.league !== league) return false;
      const kick = new Date(f.kickoff).getTime();
      return kick >= fromMs && kick <= toMs;
    });
  }

  getPlayerMatchStats(fixtureId) {
    if (!this.#gwSample?.fixtures) return [];
    const block = this.#gwSample.fixtures.find(
      (f) => f.provider_id === fixtureId || f.fixture_id === fixtureId,
    );
    return block?.players ?? [];
  }

  getGameweekSample() {
    return this.#gwSample;
  }

  getRankings(league) {
    const ids = this.#rankings[league] ?? [];
    const byId = new Map(this.#players.map((p) => [p.provider_id, p]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }
}

let sharedMock = null;

export function getMockProvider() {
  if (!sharedMock) sharedMock = new MockProvider();
  return sharedMock;
}
