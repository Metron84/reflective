import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { isLeagueLocked } from "@/lib/ultima/server/lineup";

function gwTotal(score) {
  if (!score) return null;
  const n = Number(score.points) + Number(score.bolt_points);
  return Number.isFinite(n) ? n : null;
}

function rankIds(ids, scoreOf) {
  const sorted = [...ids].sort((a, b) => {
    const av = scoreOf(a) ?? -1;
    const bv = scoreOf(b) ?? -1;
    if (bv !== av) return bv - av;
    return String(a).localeCompare(String(b));
  });
  const rank = new Map();
  sorted.forEach((id, index) => rank.set(id, index + 1));
  return rank;
}

export async function getTableOffice({ competitionId, managerId }) {
  const db = getUltimaDb();
  if (!db || !competitionId) return null;

  const [{ data: competition }, { data: managers }, { data: personas }, { data: gameweeks }, { data: scores }, lineupPack] =
    await Promise.all([
      db
        .from("ultima_competition")
        .select("id, season_label")
        .eq("id", competitionId)
        .maybeSingle(),
      db
        .from("ultima_managers")
        .select("id, team_name, manager_name, colour, is_bot, persona_id, draft_slot")
        .eq("competition_id", competitionId)
        .order("draft_slot"),
      db.from("ultima_bot_personas").select("id, name"),
      db
        .from("ultima_gameweeks")
        .select("id, number, state, league_open_at")
        .eq("competition_id", competitionId)
        .order("number", { ascending: true }),
      db
        .from("ultima_manager_gameweek_scores")
        .select("manager_id, gameweek_id, points, bolt_points, state"),
      getCurrentGameweek(competitionId).then(async (gw) => {
        if (!gw?.id) return { gw: null, lineups: [] };
        const visible =
          gw.state === "final" ||
          ULTIMA_LEAGUES.every((league) => isLeagueLocked(gw, league));
        if (!visible) return { gw, lineups: [] };
        const { data } = await db
          .from("ultima_lineups")
          .select("manager_id, slot_group, ultima_players(name, club, league)")
          .eq("gameweek_id", gw.id)
          .not("player_id", "is", null);
        return { gw, lineups: data ?? [] };
      }),
    ]);

  const personaById = new Map((personas ?? []).map((p) => [p.id, p.name]));
  const seats = (managers ?? []).map((m) => ({
    id: m.id,
    team_name: m.team_name,
    manager_name: m.is_bot
      ? personaById.get(m.persona_id) ?? "BOT"
      : m.manager_name,
    colour: m.colour,
    is_bot: Boolean(m.is_bot),
    draft_slot: m.draft_slot,
  }));
  const ids = seats.map((s) => s.id);

  const gws = gameweeks ?? [];
  const scoreMap = new Map();
  for (const row of scores ?? []) {
    scoreMap.set(`${row.manager_id}:${row.gameweek_id}`, row);
  }

  const scoredGwIds = new Set((scores ?? []).map((s) => s.gameweek_id));
  const scoredGws = gws.filter((gw) => scoredGwIds.has(gw.id));
  const beforeFirst = scoredGws.length === 0;

  const seasonRunning = Object.fromEntries(ids.map((id) => [id, 0]));
  const snapshots = [];
  for (const gw of scoredGws) {
    for (const id of ids) {
      const total = gwTotal(scoreMap.get(`${id}:${gw.id}`));
      if (total != null) seasonRunning[id] += total;
    }
    snapshots.push({
      gwId: gw.id,
      number: gw.number,
      season: { ...seasonRunning },
      rank: rankIds(ids, (id) => seasonRunning[id]),
      gwRank: rankIds(ids, (id) => gwTotal(scoreMap.get(`${id}:${gw.id}`))),
    });
  }

  const latest = snapshots[snapshots.length - 1] ?? null;
  const previous = snapshots[snapshots.length - 2] ?? null;
  const currentGw = lineupPack?.gw ?? gws[gws.length - 1] ?? null;
  const live = currentGw?.state === "live";
  const allLocked = currentGw
    ? ULTIMA_LEAGUES.every((league) => isLeagueLocked(currentGw, league))
    : false;
  const xvVisible = Boolean(allLocked || currentGw?.state === "final");

  const rows = seats.map((seat) => {
    const gwScores = scoredGws.map((gw) => ({
      number: gw.number,
      points: gwTotal(scoreMap.get(`${seat.id}:${gw.id}`)),
      bolt: Number(scoreMap.get(`${seat.id}:${gw.id}`)?.bolt_points ?? 0),
    }));
    const seasonPoints = latest ? latest.season[seat.id] ?? 0 : null;
    const rank = latest ? latest.rank.get(seat.id) ?? null : null;
    const prevRank = previous ? previous.rank.get(seat.id) ?? null : null;
    const movement =
      rank != null && prevRank != null ? prevRank - rank : null;
    const recent = snapshots.slice(-5);
    const form = Array.from({ length: 5 }, (_, index) => {
      const snap = recent[index - (5 - recent.length)];
      if (!snap) return null;
      const total = gwTotal(scoreMap.get(`${seat.id}:${snap.gwId}`));
      return total == null ? null : snap.gwRank.get(seat.id) ?? null;
    });
    const highest = gwScores.reduce((max, row) => {
      if (row.points == null) return max;
      return max == null || row.points > max ? row.points : max;
    }, null);
    const lastGw = gwScores[gwScores.length - 1] ?? null;
    const boltHits = gwScores.filter((row) => row.bolt > 0).length;
    const boltPoints = gwScores.reduce((sum, row) => sum + (row.bolt || 0), 0);

    return {
      id: seat.id,
      team_name: seat.team_name,
      manager_name: seat.manager_name,
      colour: seat.colour,
      is_bot: seat.is_bot,
      draft_slot: seat.draft_slot,
      yours: seat.id === managerId,
      rank,
      seasonPoints,
      gameweekPoints: lastGw?.points ?? null,
      boltPoints,
      boltHits,
      highestGw: highest,
      movement,
      form,
      lastScores: gwScores.slice(-5),
    };
  });

  rows.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  const gameweeksView = gws.map((gw) => {
    const ranked = [...seats]
      .map((seat) => ({
        id: seat.id,
        points: gwTotal(scoreMap.get(`${seat.id}:${gw.id}`)),
      }))
      .sort((a, b) => (b.points ?? -1) - (a.points ?? -1));
    const top = ranked[0]?.points;
    const motw = new Set(
      ranked.filter((row) => row.points != null && row.points === top).map((row) => row.id),
    );
    return {
      id: gw.id,
      number: gw.number,
      state: gw.state,
      live: gw.state === "live",
      rows: seats
        .map((seat) => {
          const points = gwTotal(scoreMap.get(`${seat.id}:${gw.id}`));
          const rank = rankIds(
            ids,
            (id) => gwTotal(scoreMap.get(`${id}:${gw.id}`)),
          ).get(seat.id);
          return {
            id: seat.id,
            rank: points == null ? null : rank,
            points,
            motw: motw.has(seat.id) && points != null,
          };
        })
        .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
    };
  });

  const you = rows.find((row) => row.yours) ?? null;
  const first = rows[0] ?? null;
  const youIndex = rows.findIndex((row) => row.yours);
  const below = youIndex >= 0 ? rows[youIndex + 1] ?? null : null;
  const gapFirst =
    you?.seasonPoints != null && first?.seasonPoints != null
      ? first.seasonPoints - you.seasonPoints
      : null;
  const gapBelow =
    you?.seasonPoints != null && below?.seasonPoints != null
      ? you.seasonPoints - below.seasonPoints
      : null;

  const xvByManager = {};
  if (xvVisible) {
    for (const row of lineupPack?.lineups ?? []) {
      const league = row.ultima_players?.league ?? row.slot_group;
      const pack = xvByManager[row.manager_id] ?? {};
      const list = pack[league] ?? [];
      if (row.ultima_players?.name) list.push(row.ultima_players.name);
      pack[league] = list;
      xvByManager[row.manager_id] = pack;
    }
  }

  const seasonLabel = competition?.season_label
    ? String(competition.season_label).startsWith("Ultima")
      ? competition.season_label
      : `Ultima ${competition.season_label}`
    : "Ultima";

  return {
    seasonLabel,
    beforeFirst,
    live,
    currentGw: currentGw ? { id: currentGw.id, number: currentGw.number, state: currentGw.state } : null,
    afterGw: latest?.number ?? null,
    xvVisible,
    youId: managerId,
    stats: [
      { label: "Position", value: you?.rank != null ? String(you.rank) : "-" },
      { label: "Season points", value: you?.seasonPoints != null ? String(you.seasonPoints) : "-" },
      { label: "Gap to 1st", value: gapFirst != null ? String(gapFirst) : "-" },
      { label: "Gap to below", value: gapBelow != null ? String(gapBelow) : "-" },
    ],
    rows,
    gameweeks: gameweeksView,
    bolt: [...rows]
      .sort((a, b) => (b.boltPoints ?? 0) - (a.boltPoints ?? 0))
      .map((row) => ({
        id: row.id,
        team_name: row.team_name,
        yours: row.yours,
        colour: row.colour,
        boltPoints: row.boltPoints,
        boltHits: row.boltHits,
      })),
    draftOrder: seats
      .slice()
      .sort((a, b) => (a.draft_slot ?? 99) - (b.draft_slot ?? 99))
      .map((seat) => ({
        id: seat.id,
        team_name: seat.team_name,
        manager_name: seat.manager_name,
        draft_slot: seat.draft_slot,
        colour: seat.colour,
        yours: seat.id === managerId,
      })),
    xvByManager,
    showSyncNote: Boolean(live || currentGw?.state === "provisional"),
  };
}
