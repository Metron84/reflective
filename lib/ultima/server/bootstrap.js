import { getStatsProvider } from "@/lib/ultima/provider/index";
import { getUltimaDb } from "@/lib/ultima/server/db";

/**
 * Bootstrap gameweek 12 sample fixtures and stats from mock seed.
 */
export async function bootstrapSampleGameweek(competitionId) {
  const db = getUltimaDb();
  if (!db) return { ok: false, error: "no_db" };

  const provider = getStatsProvider();
  const sample = provider.getGameweekSample();
  if (!sample) return { ok: false, error: "no_sample" };

  const { data: existing } = await db
    .from("ultima_gameweeks")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("number", sample.gameweek)
    .maybeSingle();

  if (existing) return { ok: true, gameweekId: existing.id, skipped: true };

  const { data: gw, error: gwErr } = await db
    .from("ultima_gameweeks")
    .insert({
      competition_id: competitionId,
      number: sample.gameweek,
      window_start: sample.window_start,
      window_end: sample.window_end,
      league_open_at: sample.league_open_at,
      state: "final",
    })
    .select("id")
    .single();

  if (gwErr || !gw) return { ok: false, error: gwErr?.message };

  const { data: allPlayers } = await db.from("ultima_players").select("id, provider_id, league");
  const byProvider = new Map(
    (allPlayers ?? []).map((p) => [`${p.league}:${p.provider_id}`, p.id]),
  );

  for (const fix of sample.fixtures ?? []) {
    const league =
      fix.league ??
      (fix.provider_id?.includes("-ll-")
        ? "laliga"
        : fix.provider_id?.includes("-pl-")
          ? "pl"
          : fix.provider_id?.includes("-sa-")
            ? "seriea"
            : fix.provider_id?.includes("-bl-")
              ? "bundesliga"
              : fix.provider_id?.includes("-l1-")
                ? "ligue1"
                : "pl");

    const { data: fixtureRow } = await db
      .from("ultima_fixtures")
      .upsert(
        {
          provider_id: fix.provider_id,
          league,
          kickoff: sample.window_start,
          status: "finished",
          gameweek_id: gw.id,
        },
        { onConflict: "provider_id" },
      )
      .select("id")
      .single();

    if (!fixtureRow) continue;

    for (const ps of fix.players ?? []) {
      const playerId = byProvider.get(`${league}:${ps.provider_id}`);
      if (!playerId) continue;

      await db.from("ultima_player_match_stats").upsert(
        {
          fixture_id: fixtureRow.id,
          player_id: playerId,
          goals: ps.goals ?? 0,
          assists: ps.assists ?? 0,
          rating: ps.rating ?? null,
        },
        { onConflict: "fixture_id,player_id" },
      );
    }
  }

  return { ok: true, gameweekId: gw.id };
}

export async function getCurrentGameweek(competitionId) {
  const db = getUltimaDb();
  if (!db) return null;

  const { data } = await db
    .from("ultima_gameweeks")
    .select("*")
    .eq("competition_id", competitionId)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function getGameweekByNumber(competitionId, number) {
  const db = getUltimaDb();
  if (!db) return null;
  const { data } = await db
    .from("ultima_gameweeks")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("number", number)
    .maybeSingle();
  return data;
}
