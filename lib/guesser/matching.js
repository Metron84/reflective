/** Client-safe guess matching utilities (no fs / pool imports). */

export function normalize(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/gi, "")
    .toLowerCase()
    .trim();
}

function nameTokens(name) {
  return normalize(name).split(/\s+/).filter(Boolean);
}

/** All normalized keys that should resolve to this pool row. */
export function matchKeysForPlayer(player) {
  const keys = new Set();
  const full = normalize(player.name);
  if (full) keys.add(full);
  for (const alias of player.aliases ?? []) {
    const a = normalize(alias);
    if (a) keys.add(a);
  }
  const tokens = nameTokens(player.name);
  for (const t of tokens) keys.add(t);
  const surname = tokens.at(-1);
  if (surname) keys.add(surname);
  return keys;
}

/** Group pool rows by display name for disambiguation vs auto-submit. */
export function groupByPerson(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = normalize(row.name);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

/** Prefer the row with league data when several rows share a name. */
export function pickBestRow(rows) {
  return rows.find((p) => p.league != null) ?? rows[0];
}

export function contextLine(player) {
  const era =
    player.era_start && player.era_end
      ? `${player.era_start}-${player.era_end}`
      : player.era_start
        ? `${player.era_start}+`
        : "";
  return [player.nationality, era].filter(Boolean).join(" · ");
}

/** Prefix filter for the suggestion panel (client-safe). */
export function filterSuggestionList(suggestions, query, limit = 8) {
  const q = normalize(query);
  if (!q) return [];
  const out = [];
  for (const s of suggestions) {
    const nameNorm = normalize(s.name);
    const tokens = nameNorm.split(/\s+/);
    if (
      nameNorm.startsWith(q) ||
      tokens.some((t) => t.startsWith(q)) ||
      (q.length >= 3 && nameNorm.includes(q))
    ) {
      out.push(s);
      if (out.length >= limit) break;
    }
  }
  return out;
}
