/**
 * Pure helpers for scripts/crest-club-media.mjs: pick the Sportmonks team for a club
 * and find the two dominant badge colours. No network, no image decoder, no aliases,
 * so Node scripts and tests can import it directly.
 */

export function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Fallback /teams/search queries: common_name, then name, then name without generic prefixes. */
export function searchQueries(club) {
  const plain = String(club.name || "")
    .replace(/\b(FC|AFC|SC|CF|AC|AS|SV|FK|SK|BK|1\.|VfL|VfB|TSG|FSV)\b\.?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...new Set([club.common_name, club.name, plain].filter(Boolean))];
}

/** 0 to about 140. Same scoring as scripts/crest/enrich-sportmonks.mjs. */
export function scoreCandidate(club, team) {
  const names = [club.name, club.slug?.replace(/-/g, " ")].filter(Boolean);
  const teamName = normalizeName(team.name);
  let best = 0;

  for (const raw of names) {
    const n = normalizeName(raw);
    if (!n) continue;
    if (n === teamName) best = Math.max(best, 100);
    else if (teamName.includes(n) || n.includes(teamName)) best = Math.max(best, 65);
    else {
      const tokens = n.split(" ").filter(Boolean);
      const hits = tokens.filter((t) => teamName.includes(t)).length;
      if (tokens.length && hits === tokens.length) best = Math.max(best, 55);
    }
  }

  if (club.founded && team.founded && Number(club.founded) === Number(team.founded)) best += 25;

  const teamCountry = team.country?.name ?? null;
  if (club.country && teamCountry) {
    const a = normalizeName(club.country);
    const b = normalizeName(teamCountry);
    if (a === b || a.includes(b) || b.includes(a)) best += 15;
  }
  return best;
}

/**
 * Take the clear winner or nothing. Never guesses: a weak best score, a near tie,
 * a national team or a team with no image all come back unmatched with a reason.
 *
 * @returns {{team: object|null, reason: string}}
 */
export function pickTeam(club, candidates) {
  const usable = (candidates ?? []).filter((t) => t && !t.national_team);
  if (!usable.length) return { team: null, reason: "no candidates" };
  const scored = usable
    .map((team) => ({ team, score: scoreCandidate(club, team) }))
    .sort((a, b) => b.score - a.score);
  const [top, second] = scored;
  if (top.score < 70) return { team: null, reason: `best score ${top.score} below 70 (${top.team.name})` };
  if (second && top.score - second.score < 15) {
    return { team: null, reason: `tie risk: ${top.team.name} (${top.score}) vs ${second.team.name} (${second.score})` };
  }
  if (!top.team.image_path) return { team: null, reason: `${top.team.name} has no image_path` };
  return { team: top.team, reason: "unambiguous" };
}

const hex = (rgb) =>
  "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

/** Colours Sportmonks itself supplies, if the payload carries any. Two hex strings or null. */
export function sportmonksColours(team) {
  const raw = team?.colours ?? team?.colors ?? team?.kit_colours ?? null;
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[,\s]+/)
      : raw && typeof raw === "object"
        ? [raw.primary ?? raw.color1 ?? raw.colour1, raw.secondary ?? raw.color2 ?? raw.colour2]
        : [];
  const found = list
    .map((c) => String(c ?? "").trim())
    .map((c) => (/^#?[0-9a-f]{6}$/i.test(c) ? "#" + c.replace("#", "").toUpperCase() : null))
    .filter(Boolean);
  return found.length ? { primary: found[0], secondary: found[1] ?? null } : null;
}

const isWhite = ([r, g, b]) => Math.min(r, g, b) >= 225;
const isBlack = ([r, g, b]) => Math.max(r, g, b) <= 45;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Two dominant colours from raw RGBA pixels, ignoring transparent, near-white and
 * near-black pixels. Buckets are 16 levels per channel; the second colour must be
 * visibly different from the first (distance 70 or more). Secondary is null when the
 * badge only has one usable colour.
 *
 * @param {Uint8Array|Uint8ClampedArray|Buffer} rgba  4 bytes per pixel
 * @returns {{primary: string, secondary: string|null}|null}
 */
export function dominantColours(rgba) {
  const buckets = new Map();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    const px = [rgba[i], rgba[i + 1], rgba[i + 2]];
    if (isWhite(px) || isBlack(px)) continue;
    const key = (px[0] >> 4) * 256 + (px[1] >> 4) * 16 + (px[2] >> 4);
    const b = buckets.get(key) ?? { n: 0, sum: [0, 0, 0] };
    b.n += 1;
    for (let c = 0; c < 3; c += 1) b.sum[c] += px[c];
    buckets.set(key, b);
  }
  const ranked = [...buckets.values()]
    .map((b) => ({ n: b.n, rgb: b.sum.map((s) => s / b.n) }))
    .sort((a, b) => b.n - a.n);
  if (!ranked.length) return null;
  const first = ranked[0];
  const second = ranked.find((c) => dist(c.rgb, first.rgb) >= 70);
  return { primary: hex(first.rgb), secondary: second ? hex(second.rgb) : null };
}

/* ---------------------------------------------------------------------------
 * League-first matching: fetch every team of a competition's current season and
 * match club slugs locally. Search is the fallback, not the plan.
 * ------------------------------------------------------------------------- */

/** Prefixes and suffixes that do not identify a club. Digit-only tokens are dropped too. */
const GENERIC = new Set([
  "fc", "ac", "ssc", "cf", "afc", "sc", "as", "sv", "fk", "sk", "bk", "us", "ud", "rc",
  "rcd", "cd", "ca", "vfl", "vfb", "tsg", "fsv", "ssv", "sd", "if", "ogc", "aj", "de", "the",
]);

/** Name with accents, punctuation, generic prefixes/suffixes and digit-only tokens removed. */
export function teamKey(name) {
  const tokens = normalizeName(name).split(" ").filter(Boolean);
  const kept = tokens.filter((t) => !GENERIC.has(t) && !/^\d+$/.test(t));
  return (kept.length ? kept : tokens).join(" ");
}

/**
 * Known aliases: normalised club name or slug words -> names Sportmonks may use.
 * Only used inside the club's own league, so a loose alias cannot reach another club.
 */
export const ALIASES = {
  "inter milan": ["inter", "internazionale"],
  internazionale: ["inter"],
  "bayern munich": ["fc bayern munchen", "bayern munchen"],
  psg: ["paris saint germain", "paris sg"],
  "paris saint germain": ["paris sg", "paris saint germain"],
  "atletico madrid": ["atletico de madrid", "atletico madrid"],
  marseille: ["olympique marseille", "olympique de marseille"],
  "borussia monchengladbach": ["borussia m gladbach", "monchengladbach"],
  "bayer leverkusen": ["bayer 04 leverkusen"],
  rennes: ["stade rennais"],
  // Sportmonks spells it "A Coruña". Matched exactly in pass 1, so it can never fall through
  // to containment and claim Deportivo Alavés (both start with "Deportivo").
  "deportivo la coruna": ["deportivo a coruna"],
  napoli: ["ssc napoli"],
};

/** Every name a club may be listed under, as match keys. */
export function clubKeys(club) {
  const raw = [club.name, club.common_name, club.slug?.replace(/-/g, " ")].filter(Boolean);
  const names = new Set(raw);
  for (const n of raw) for (const alias of ALIASES[normalizeName(n)] ?? []) names.add(alias);
  return [...new Set([...names].map(teamKey).filter(Boolean))];
}

const tokensOf = (key) => new Set(key.split(" ").filter(Boolean));
const subset = (a, b) => [...a].every((t) => b.has(t));

/**
 * Match every club of one competition to the teams of that league's current season.
 * Pass 1 takes exact key matches. Pass 2 takes token containment (either direction, needs
 * a token of 4+ letters) among teams pass 1 did not use, so "Paris FC" cannot grab
 * Paris Saint-Germain. More than one hit is reported as ambiguous, never guessed.
 *
 * @param {object[]} clubs  clubs of one competition
 * @param {object[]} teams  that league's season teams
 * @returns {Map<string, {team: object|null, reason: string}>} keyed by club slug
 */
export function matchLeagueClubs(clubs, teams) {
  const result = new Map();
  const used = new Set();
  const withKeys = clubs.map((club) => ({ club, keys: clubKeys(club) }));
  const teamsOk = teams ?? [];

  for (const { club, keys } of withKeys) {
    const exact = teamsOk.filter((t) => keys.includes(teamKey(t.name)));
    if (exact.length === 1) {
      used.add(exact[0].id);
      result.set(club.slug, exact[0].image_path
        ? { team: exact[0], reason: "league match" }
        : { team: null, reason: `${exact[0].name} has no image_path` });
    } else if (exact.length > 1) {
      result.set(club.slug, { team: null, reason: `ambiguous in league: ${exact.map((t) => t.name).join(" / ")}` });
    }
  }

  const free = teamsOk.filter((t) => !used.has(t.id));
  for (const { club, keys } of withKeys) {
    if (result.has(club.slug)) continue;
    const hits = free.filter((t) => {
      const tk = tokensOf(teamKey(t.name));
      return keys.some((k) => {
        const ck = tokensOf(k);
        const small = ck.size <= tk.size ? ck : tk;
        return [...small].some((x) => x.length >= 4) && (subset(ck, tk) || subset(tk, ck));
      });
    });
    if (hits.length > 1) {
      result.set(club.slug, { team: null, reason: `ambiguous in league: ${hits.map((t) => t.name).join(" / ")}` });
    } else if (hits.length === 1) {
      result.set(club.slug, hits[0].image_path
        ? { team: hits[0], reason: "league match (partial name)" }
        : { team: null, reason: `${hits[0].name} has no image_path` });
    } else {
      result.set(club.slug, { team: null, reason: "not found in league teams" });
    }
  }

  // Two clubs on one team means one of them is wrong. Neither is kept.
  const byTeam = new Map();
  for (const [slug, r] of result) if (r.team) byTeam.set(r.team.id, [...(byTeam.get(r.team.id) ?? []), slug]);
  for (const slugs of byTeam.values()) {
    if (slugs.length > 1) {
      for (const slug of slugs) result.set(slug, { team: null, reason: `team claimed by ${slugs.join(" and ")}` });
    }
  }
  return result;
}

/**
 * Crest competition -> how Sportmonks lists it: country plus accepted names (normalised
 * equality, so "Bundesliga" never matches "2. Bundesliga"). `env` is the Ultima league ID
 * variable, which wins over discovery when set.
 */
export const LEAGUE_MATCHERS = {
  "Premier League": { env: "SPORTMONKS_LEAGUE_ID_PL", country: ["england"], names: ["premier league"] },
  Championship: { country: ["england"], names: ["championship", "efl championship"] },
  "League One": { country: ["england"], names: ["league one", "efl league one"] },
  LaLiga: { env: "SPORTMONKS_LEAGUE_ID_LALIGA", country: ["spain"], names: ["la liga", "laliga", "primera division"] },
  "LaLiga 2": { country: ["spain"], names: ["la liga 2", "laliga 2", "segunda division", "laliga hypermotion"] },
  "Serie A": { env: "SPORTMONKS_LEAGUE_ID_SERIEA", country: ["italy"], names: ["serie a"] },
  "Serie B": { country: ["italy"], names: ["serie b"] },
  Bundesliga: { env: "SPORTMONKS_LEAGUE_ID_BUNDESLIGA", country: ["germany"], names: ["bundesliga"] },
  "2. Bundesliga": { country: ["germany"], names: ["2 bundesliga"] },
  "Ligue 1": { env: "SPORTMONKS_LEAGUE_ID_LIGUE1", country: ["france"], names: ["ligue 1"] },
  "Ligue 2": { country: ["france"], names: ["ligue 2"] },
  Eredivisie: { country: ["netherlands"], names: ["eredivisie"] },
  "Scottish Premiership": { country: ["scotland"], names: ["premiership", "scottish premiership"] },
  "Super League Greece": { country: ["greece"], names: ["super league", "super league 1"] },
  HNL: { country: ["croatia"], names: ["hnl", "1 hnl", "prva hnl", "supersport hnl"] },
  "Czech First League": { country: ["czech republic", "czechia"], names: ["first league", "czech liga", "fortuna liga", "chance liga"] },
  "Süper Lig": { country: ["turkey", "turkiye"], names: ["super lig"] },
};

/**
 * Pick the Sportmonks league for each Crest competition from /leagues rows, with env
 * overrides first. A competition with no row is outside the plan (or not covered).
 *
 * @param {object[]} leagueRows  rows from /leagues?include=country
 * @param {Record<string, string|undefined>} env
 * @returns {Record<string, {id: number, name: string, source: "env"|"discovered"}|null>}
 */
export function resolveLeagues(leagueRows, env = {}) {
  const out = {};
  for (const [competition, m] of Object.entries(LEAGUE_MATCHERS)) {
    const fromEnv = m.env ? Number(String(env[m.env] ?? "").trim()) : NaN;
    if (Number.isFinite(fromEnv) && fromEnv > 0) {
      out[competition] = { id: fromEnv, name: competition, source: "env" };
      continue;
    }
    const row = (leagueRows ?? []).find(
      (l) =>
        m.names.includes(normalizeName(l.name)) &&
        m.country.includes(normalizeName(l.country?.name ?? "")),
    );
    out[competition] = row ? { id: row.id, name: row.name, source: "discovered" } : null;
  }
  return out;
}

/**
 * Why a club is still unmatched. `leagueState` is the outcome for the club's league:
 * { status: "ok" | "outside_plan" | "empty_season" | "unresolved", teams?: team[] | number }.
 */
export function unmatchedCategory(club, leagueState, detail) {
  if (!club.competition) {
    return { category: "no_competition", reason: "club has no competition, so no league to search" };
  }
  const s = leagueState ?? { status: "unresolved" };
  if (s.status === "outside_plan") {
    return { category: "league_outside_plan", reason: `${club.competition} is outside the plan (403)` };
  }
  if (s.status === "unresolved") {
    return {
      category: "league_outside_plan",
      reason: `${club.competition} is not in the plan's league list`,
    };
  }
  if (s.status === "empty_season") {
    return { category: "league_empty_season", reason: `${club.competition} returned an empty current season` };
  }
  const list = Array.isArray(s.teams) ? s.teams : [];
  const count = Array.isArray(s.teams) ? s.teams.length : s.teams;
  const closest = closestTeams(club, list);
  return {
    category: "not_found",
    reason: `not found among ${count} ${club.competition} teams${closest.length ? ` (closest: ${closest.join(", ")})` : ""}; ${detail}`,
  };
}

/**
 * Validate one manual override. Valid shapes: sportmonks_id and/or badge_url (with optional
 * colours), or colours only (primary, optional secondary), which gives the club its colours
 * and no badge. Secondary on its own is not valid. Returns { value } or { error }.
 */
export function parseOverride(raw) {
  if (!raw || typeof raw !== "object") return { error: "not an object" };
  const out = {};
  if (raw.sportmonks_id != null) {
    const id = Number(raw.sportmonks_id);
    if (!Number.isInteger(id) || id <= 0) return { error: "sportmonks_id must be a positive integer" };
    out.sportmonks_id = id;
  }
  if (raw.badge_url != null) {
    if (!/^https:\/\//.test(String(raw.badge_url))) return { error: "badge_url must be an https URL" };
    out.badge_url = String(raw.badge_url);
  }
  for (const k of ["primary", "secondary"]) {
    if (raw[k] == null) continue;
    if (!/^#[0-9a-f]{6}$/i.test(String(raw[k]))) return { error: `${k} must be a #RRGGBB colour` };
    out[k] = String(raw[k]).toUpperCase();
  }
  if (out.secondary && !out.primary) return { error: "secondary needs a primary" };
  if (out.sportmonks_id == null && out.badge_url == null && !out.primary) {
    return { error: "needs sportmonks_id, badge_url, or primary and secondary colours" };
  }
  return { value: out };
}

/** True when an override carries colours only: no badge, no Sportmonks lookup, no network. */
export function isColourOnly(o) {
  return o.sportmonks_id == null && o.badge_url == null && Boolean(o.primary);
}

const bigrams = (text) => {
  const t = ` ${text} `;
  const out = new Map();
  for (let i = 0; i < t.length - 1; i += 1) out.set(t.slice(i, i + 2), (out.get(t.slice(i, i + 2)) ?? 0) + 1);
  return out;
};

/** Dice similarity of two strings on character bigrams, 0 to 1. */
export function similarity(a, b) {
  const x = bigrams(a);
  const y = bigrams(b);
  let overlap = 0;
  let total = 0;
  for (const n of x.values()) total += n;
  for (const n of y.values()) total += n;
  for (const [k, n] of x) overlap += Math.min(n, y.get(k) ?? 0);
  return total ? (2 * overlap) / total : 0;
}

/** Names of the league teams closest to a club, for the not_found report. */
export function closestTeams(club, teams, n = 3) {
  const keys = clubKeys(club);
  return (teams ?? [])
    .map((t) => ({ name: t.name, score: Math.max(0, ...keys.map((k) => similarity(k, teamKey(t.name)))) }))
    .sort((p, q) => q.score - p.score)
    .slice(0, n)
    .map((t) => t.name);
}
