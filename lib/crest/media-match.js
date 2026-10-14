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

/** Query variants to try, most specific first. Duplicates removed. */
export function searchQueries(club) {
  const plain = String(club.name || "")
    .replace(/\b(FC|AFC|SC|CF|AC|AS|SV|FK|SK|BK|1\.|VfL|VfB|TSG|FSV)\b\.?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...new Set([club.name, plain].filter(Boolean))];
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
