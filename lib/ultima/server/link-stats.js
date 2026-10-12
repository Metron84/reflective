import { indexPlayersBySportmonksId, playerIdForSportmonks } from "@/lib/ultima/player-link";

const PAGE = 400;

export async function loadPlayerIndex(db) {
  const players = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("ultima_players")
      .select("id, provider_id, seed_metrics")
      .range(from, from + 999);
    if (error) return { index: null, error: error.message };
    players.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return { index: indexPlayersBySportmonksId(players) };
}

/**
 * Set player_id on stat rows whose Sportmonks id matches exactly one
 * ultima_players.provider_id third field. Rows that already have that
 * fixture and player are left alone. Pass fixtureIds to limit the pass to one
 * gameweek's fixtures.
 */
export async function linkNullStatPlayers(db, { cursor = null, limit = PAGE, index = null, fixtureIds = null } = {}) {
  let playerIndex = index;
  if (!playerIndex) {
    const loaded = await loadPlayerIndex(db);
    if (loaded.error) return { linked: 0, cursor, done: false, error: loaded.error };
    playerIndex = loaded.index;
  }
  let query = db
    .from("ultima_player_match_stats")
    .select("id, fixture_id, sportmonks_player_id")
    .is("player_id", null)
    .order("id", { ascending: true })
    .limit(limit);
  if (Array.isArray(fixtureIds)) query = query.in("fixture_id", fixtureIds);
  if (cursor) query = query.gt("id", cursor);
  const { data: rows, error } = await query;
  if (error) return { linked: 0, cursor, done: false, error: error.message };

  const page = rows ?? [];
  const nextCursor = page.length ? page[page.length - 1].id : cursor;
  const matches = [];
  for (const row of page) {
    const playerId = playerIdForSportmonks(playerIndex, row.sportmonks_player_id);
    if (!playerId) continue;
    matches.push({ id: row.id, fixture_id: row.fixture_id, player_id: playerId });
  }

  const taken = new Set();
  const matchedFixtures = [...new Set(matches.map((row) => row.fixture_id))];
  for (let i = 0; i < matchedFixtures.length; i += 80) {
    const slice = matchedFixtures.slice(i, i + 80);
    const { data: existing } = await db
      .from("ultima_player_match_stats")
      .select("fixture_id, player_id")
      .in("fixture_id", slice)
      .not("player_id", "is", null);
    for (const row of existing ?? []) taken.add(`${row.fixture_id}:${row.player_id}`);
  }

  let linked = 0;
  const pending = [];
  for (const row of matches) {
    const key = `${row.fixture_id}:${row.player_id}`;
    if (taken.has(key)) continue;
    taken.add(key);
    pending.push(row);
  }

  const stamp = new Date().toISOString();
  for (let i = 0; i < pending.length; i += 40) {
    const slice = pending.slice(i, i + 40);
    const results = await Promise.all(slice.map((row) => (
      db.from("ultima_player_match_stats")
        .update({ player_id: row.player_id, updated_at: stamp })
        .eq("id", row.id)
        .is("player_id", null)
        .select("id")
    )));
    for (const result of results) {
      if (!result.error && (result.data ?? []).length) linked += 1;
    }
  }

  return { linked, cursor: nextCursor, done: page.length < limit };
}
