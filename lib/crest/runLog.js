/**
 * One crest_runs row. Club names the player picked stay in roots.
 * No player name, email, IP, or user agent.
 */

const REGIONS = ["England", "Germany", "Italy", "Spain", "France", "Rest of the World"];

/**
 * @param {unknown} input
 * @param {string} createdAt
 */
export function crestRunInsert(input, createdAt) {
  const source = input && typeof input === "object" ? input : {};
  const born = bornToValue(source.born);
  return {
    created_at: createdAt,
    app_version: clip(source.appVersion ?? source.app_version, 32),
    scope: scopeOf(source.scope ?? source.group),
    stake: clip(source.stake, 64),
    roots: rootsOf(source.roots),
    answers: answersOf(source.answers),
    hero_slug: clip(source.heroSlug ?? source.hero_slug ?? source.built?.slug, 80),
    runner_up_slug: clip(source.runnerUpSlug ?? source.runner_up_slug ?? source.runnerUp?.slug, 80),
    born_to: born,
    match_percents: percentsOf(source),
  };
}

/**
 * Fire after the result has rendered. Errors are ignored.
 * `runId` stops a second paint of the same run from inserting twice.
 *
 * @param {number|string} runId
 * @param {object} source
 */
export function logFinishedRun(runId, source) {
  try {
    if (runId == null || sent.has(runId)) return;
    sent.add(runId);
    const row = crestRunInsert(source, new Date().toISOString());
    fetch("/api/crest-runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(row),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* silent */
  }
}

const sent = new Set();

/**
 * @param {unknown} value
 * @param {number} max
 * @returns {string|null}
 */
function clip(value, max) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, max);
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function scopeOf(value) {
  if (value == null || value === "" || value === "everywhere") return null;
  return REGIONS.includes(value) ? value : null;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function bornToValue(value) {
  if (typeof value === "string") return clip(value, 120);
  if (!value || typeof value !== "object") return null;
  if (value.typed || !value.slug) return clip(value.name, 120);
  return clip(value.slug, 80);
}

/**
 * @param {unknown} value
 */
function rootsOf(value) {
  if (!value || typeof value !== "object") return null;
  const hooked = value.hooked;
  return {
    family: clubOf(value.family),
    grew: clubOf(value.grew),
    hooked: hooked && typeof hooked === "object"
      ? {
          source: clip(hooked.source, 32),
          club: clubOf(hooked.club),
        }
      : null,
    stay: clip(value.stay, 16),
  };
}

/**
 * @param {unknown} value
 */
function clubOf(value) {
  if (!value || typeof value !== "object") return null;
  const name = clip(value.name, 120);
  if (!name) return null;
  const typed = Boolean(value.typed) || !value.slug;
  return {
    slug: typed ? null : clip(value.slug, 80),
    name,
    typed,
  };
}

/**
 * @param {unknown} value
 */
function answersOf(value) {
  if (!Array.isArray(value)) return [];
  const rows = [];
  for (const row of value) {
    if (rows.length >= 20) break;
    if (!row || typeof row !== "object") continue;
    const cardId = Number(row.cardId);
    const stored = Number(row.value);
    if (!Number.isInteger(cardId) || cardId < 1 || cardId > 20) continue;
    if (stored !== -1 && stored !== 0 && stored !== 1) continue;
    rows.push({ cardId, value: stored });
  }
  return rows;
}

/**
 * @param {object} source
 */
function percentsOf(source) {
  const given = source.matchPercents ?? source.match_percents;
  if (given && typeof given === "object" && !Array.isArray(given)) {
    return {
      hero: percent(given.hero),
      runnerUp: percent(given.runnerUp),
      born: percent(given.born),
      leagues: leaguesOf(given.leagues),
    };
  }
  return {
    hero: percent(source.built?.percentage),
    runnerUp: percent(source.runnerUp?.percentage),
    born: percent(source.born?.percentage),
    leagues: leaguesOf(source.regions),
  };
}

/**
 * @param {unknown} value
 */
function percent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * @param {unknown} value
 */
function leaguesOf(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).map((row) => ({
    region: REGIONS.includes(row?.region) ? row.region : null,
    slug: clip(row?.top?.slug ?? row?.slug, 80),
    percentage: percent(row?.top?.percentage ?? row?.percentage),
    sub: Array.isArray(row?.sub)
      ? row.sub.slice(0, 2).map((sub) => ({
          subregion: clip(sub?.subregion, 40),
          slug: clip(sub?.top?.slug ?? sub?.slug, 80),
          percentage: percent(sub?.top?.percentage ?? sub?.percentage),
        }))
      : null,
  }));
}
