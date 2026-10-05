import { ULTIMA_DEFAULT_RATING_THRESHOLDS, ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";
import { cleanParentClub } from "@/lib/ultima/loan";
import { resolveCaptains } from "@/lib/ultima/captains";
import { xvSlotLocked } from "@/lib/ultima/lineup/lock";
import { fixtureBasePoints } from "@/lib/ultima/scoring";
import { buildActions, buildChips, buildSwapList, cleanListNote } from "@/lib/ultima/player-card/rules";
import { ACCEPTED_STATES, LIVE_STATES } from "@/lib/ultima/trades/rules";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { getUltimaDb } from "@/lib/ultima/server/db";
import {
  getLineup,
  getManagerRoster,
  getPrevCaptains,
  removeCaptain,
  saveLineup,
  setCaptain,
  withResolvedCaptains,
} from "@/lib/ultima/server/lineup";
import { addDropTransaction } from "@/lib/ultima/server/market";
import { playerNameOf } from "@/lib/ultima/server/receipt-names";
import {
  benchedReceipt,
  captainOffReceipt,
  captainReceipt,
  signedReceipt,
  startedReceipt,
} from "@/lib/ultima/receipts";
import { getFreeAgents } from "@/lib/ultima/server/players";
import { recomputeGameweekScores } from "@/lib/ultima/server/scoring-run";
import { setBlockStance } from "@/lib/ultima/server/trade-block";
import { getTradeWindow } from "@/lib/ultima/server/trades";
import { listManagerUntouchables, setUntouchable } from "@/lib/ultima/server/untouchables";
import { getWatchlistIds, setWatchlist } from "@/lib/ultima/server/watchlist";

/** Where an action id lands. Pure ids, no database. */
export const CARD_ACTION_IDS = [
  "captain_on",
  "captain_off",
  "xv_in",
  "xv_out",
  "list",
  "unlist",
  "untouchable_on",
  "untouchable_off",
  "shortlist_on",
  "shortlist_off",
  "sign",
  "drop_sign",
];

async function ownerOf(db, competitionId, playerId) {
  const { data: row } = await db
    .from("ultima_rosters")
    .select("manager_id, ultima_managers(id, team_name, colour, is_bot)")
    .eq("competition_id", competitionId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (!row?.ultima_managers) return null;
  return row.ultima_managers;
}

async function playerStats(db, playerId, player, thresholds, gameweekId) {
  const { data } = await db
    .from("ultima_player_match_stats")
    .select("goals, assists, rating, fixture_id, ultima_fixtures(gameweek_id, kickoff, kickoff_at, status)")
    .eq("player_id", playerId)
    .limit(200);
  const rows = (data ?? [])
    .filter((r) => r.ultima_fixtures)
    .sort(
      (a, b) =>
        new Date(b.ultima_fixtures.kickoff_at ?? b.ultima_fixtures.kickoff) -
        new Date(a.ultima_fixtures.kickoff_at ?? a.ultima_fixtures.kickoff),
    );
  const t = thresholds?.[player.league] ?? ULTIMA_DEFAULT_RATING_THRESHOLDS[player.league] ?? ULTIMA_DEFAULT_RATING_THRESHOLDS.pl;
  const points = (r) => fixtureBasePoints(r, t);
  const rated = rows.map((r) => Number(r.rating)).filter((n) => Number.isFinite(n) && n > 0);
  return {
    gwPoints: gameweekId
      ? rows.filter((r) => r.ultima_fixtures.gameweek_id === gameweekId).reduce((n, r) => n + points(r), 0)
      : null,
    seasonPoints: rows.reduce((n, r) => n + points(r), 0),
    goals: rows.reduce((n, r) => n + Number(r.goals ?? 0), 0),
    assists: rows.reduce((n, r) => n + Number(r.assists ?? 0), 0),
    avgRating: rated.length ? Math.round((rated.reduce((n, v) => n + v, 0) / rated.length) * 100) / 100 : null,
    form: rows.slice(0, 5).map(points),
  };
}

/** Everything the card shows for one player, from the viewer's side. */
export async function getPlayerCard({ competition, manager, playerId }) {
  const db = getUltimaDb();
  if (!db || !competition?.id || !manager?.id || !playerId) return null;

  const { data: player } = await db.from("ultima_players").select("*").eq("id", playerId).maybeSingle();
  if (!player) return null;

  const [gameweek, owner, shortlistIds, draftRow, window] = await Promise.all([
    getCurrentGameweek(competition.id),
    ownerOf(db, competition.id, playerId),
    getWatchlistIds(manager.id),
    db
      .from("ultima_draft_state")
      .select("state")
      .eq("competition_id", competition.id)
      .maybeSingle()
      .then(({ data }) => data),
    getTradeWindow(competition.id),
  ]);

  const kind = !owner ? "free" : owner.id === manager.id ? "mine" : owner.is_bot ? "bot" : "human";

  // Lineup facts come from the owner's XV this gameweek.
  let inXv = false;
  let captain = false;
  let captainCarried = false;
  let xvFull = false;
  if (owner && gameweek?.id) {
    const [lineup, prev] = await Promise.all([
      getLineup(owner.id, gameweek.id),
      getPrevCaptains(owner.id, gameweek),
    ]);
    const resolved = resolveCaptains(lineup, prev);
    inXv = lineup.some((r) => r.player_id === playerId);
    captain = resolved.byLeague[player.league] === playerId;
    captainCarried = captain && Boolean(resolved.carried[player.league]);
    xvFull = lineup.filter((r) => r.slot_group === player.league).every((r) => r.player_id);
  }
  const slotLocked = Boolean(gameweek) && xvSlotLocked(gameweek, player.league);

  const [{ data: blockRow }, { data: offerRows }, untouchableIds, { data: thresholdRow }] = await Promise.all([
    owner
      ? db
          .from("ultima_trade_block")
          .select("stance, note")
          .eq("manager_id", owner.id)
          .eq("player_id", playerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("ultima_trade_players")
      .select("trade_id, ultima_trades!inner(state, proposer_id, receiver_id)")
      .eq("player_id", playerId),
    owner ? listManagerUntouchables(owner.id) : Promise.resolve([]),
    db.from("ultima_competition").select("rating_thresholds").eq("id", competition.id).maybeSingle(),
  ]);

  const offers = (offerRows ?? []).filter((r) => r.ultima_trades);
  const liveOffers = offers.filter((r) => LIVE_STATES.includes(r.ultima_trades.state)).length;
  const frozen = offers.some((r) => ACCEPTED_STATES.includes(r.ultima_trades.state));
  const untouchable = untouchableIds.includes(playerId);

  let liveOutgoing = 0;
  let pairLive = null;
  let untouchableCount = 0;
  if (kind === "human" || kind === "mine") {
    const { data: mine } = await db
      .from("ultima_trades")
      .select("proposer_id, receiver_id")
      .eq("competition_id", competition.id)
      .in("state", LIVE_STATES)
      .or(`proposer_id.eq.${manager.id},receiver_id.eq.${manager.id}`);
    liveOutgoing = (mine ?? []).filter((r) => r.proposer_id === manager.id).length;
    if (kind === "human") {
      const row = (mine ?? []).find((r) => r.proposer_id === owner.id || r.receiver_id === owner.id);
      if (row) pairLive = row.proposer_id === manager.id ? "sent" : "received";
    }
    if (kind === "mine") untouchableCount = (await listManagerUntouchables(manager.id)).length;
  }

  const facts = {
    kind,
    captain,
    captainCarried,
    inXv,
    xvFull,
    listed: Boolean(blockRow),
    untouchable,
    locked: inXv && slotLocked,
    slotLocked: inXv && slotLocked,
    countryLocked: slotLocked,
    frozen,
    liveOffers,
    movedFrom: player.seed_metrics?.club_moved_from ?? null,
    shortlisted: shortlistIds.includes(playerId),
    marketOpen: draftRow?.state === "complete",
    tradesOpen: window.gate?.ok !== false,
    hasGameweek: Boolean(gameweek),
    liveOutgoing,
    pairLive,
    untouchableCount,
  };

  const stats = await playerStats(db, playerId, player, thresholdRow?.rating_thresholds, gameweek?.id);

  return {
    player: {
      id: player.id,
      name: player.name,
      club: player.club,
      league: player.league,
      tag: ULTIMA_LEAGUE_SHORT[player.league] ?? player.league,
      on_loan: Boolean(player.on_loan),
      parent_club: cleanParentClub(player.parent_club),
      position: player.position ?? player.seed_metrics?.position ?? null,
    },
    owner: owner
      ? { id: owner.id, team: owner.team_name, colour: owner.colour ?? null, bot: Boolean(owner.is_bot), you: owner.id === manager.id }
      : null,
    kind,
    note: blockRow?.note ?? null,
    chips: buildChips(facts),
    actions: buildActions(facts),
    stats,
    lockAt: gameweek?.league_open_at?.[player.league] ?? null,
    gameweek: gameweek ? { id: gameweek.id, number: gameweek.number } : null,
  };
}

/**
 * The "pick who goes" list.
 * mode "add": the free agent `playerId` comes in, pick from my squad.
 * mode "drop": my player `playerId` leaves, pick from the free agents.
 */
export async function getSwapList({ competition, manager, playerId, mode }) {
  const db = getUltimaDb();
  if (!db || !competition?.id || !manager?.id || !playerId) return null;
  if (mode !== "add" && mode !== "drop") return null;

  const [roster, gameweek] = await Promise.all([getManagerRoster(manager.id), getCurrentGameweek(competition.id)]);
  const subject =
    mode === "add"
      ? (await db.from("ultima_players").select("*").eq("id", playerId).maybeSingle()).data
      : roster.find((p) => p.id === playerId);
  if (!subject) return null;

  const rosterIds = roster.map((p) => p.id);
  const lockedXvIds = [];
  if (gameweek?.id) {
    const lineup = await getLineup(manager.id, gameweek.id);
    for (const row of lineup) {
      if (row.player_id && xvSlotLocked(gameweek, row.slot_group)) lockedXvIds.push(row.player_id);
    }
  }

  const { data: frozenRows } = rosterIds.length
    ? await db
        .from("ultima_trade_players")
        .select("player_id, ultima_trades!inner(state)")
        .in("player_id", rosterIds)
        .in("ultima_trades.state", ACCEPTED_STATES)
    : { data: [] };
  const frozenIds = (frozenRows ?? []).map((r) => r.player_id);

  const { data: liveRows } = rosterIds.length
    ? await db
        .from("ultima_trade_players")
        .select("player_id, ultima_trades!inner(state, proposer_id, receiver_id)")
        .in("player_id", rosterIds)
        .in("ultima_trades.state", LIVE_STATES)
    : { data: [] };
  const otherIds = [
    ...new Set(
      (liveRows ?? []).map((r) =>
        r.ultima_trades.proposer_id === manager.id ? r.ultima_trades.receiver_id : r.ultima_trades.proposer_id,
      ),
    ),
  ];
  const { data: otherTeams } = otherIds.length
    ? await db.from("ultima_managers").select("id, team_name").in("id", otherIds)
    : { data: [] };
  const teamName = new Map((otherTeams ?? []).map((m) => [m.id, m.team_name]));
  const liveOfferTeams = new Map();
  for (const row of liveRows ?? []) {
    const trade = row.ultima_trades;
    const name = teamName.get(trade.proposer_id === manager.id ? trade.receiver_id : trade.proposer_id);
    const list = liveOfferTeams.get(row.player_id) ?? [];
    if (name && !list.includes(name)) list.push(name);
    liveOfferTeams.set(row.player_id, list);
  }

  const shortlistIds = await getWatchlistIds(manager.id);
  const candidates = mode === "add" ? roster : (await getFreeAgents(competition.id)).slice(0, 4000);
  const rows = buildSwapList({
    mode,
    roster,
    subject,
    candidates,
    lockedXvIds,
    frozenIds,
    liveOfferTeams,
    shortlistIds,
    score: (p) => Number(p.seed_metrics?.goals_rate ?? 0) * 3 + Number(p.seed_metrics?.assists_rate ?? 0) + Number(p.seed_metrics?.rating_avg ?? 0),
  });

  return {
    mode,
    subject: { id: subject.id, name: subject.name, club: subject.club, league: subject.league, tag: ULTIMA_LEAGUE_SHORT[subject.league] },
    rows: rows.slice(0, 300).map((r) => ({
      id: r.player.id,
      name: r.player.name,
      club: r.player.club,
      league: r.player.league,
      tag: ULTIMA_LEAGUE_SHORT[r.player.league] ?? r.player.league,
      on_loan: Boolean(r.player.on_loan),
      parent_club: cleanParentClub(r.player.parent_club),
      can: r.can,
      reason: r.reason,
      sameCountry: r.sameCountry,
      shortlisted: r.shortlisted,
      voids: r.voids,
    })),
  };
}

function refuse(code, message) {
  return message ? { ok: false, code, message } : { ok: false, code };
}

/** Run one card action for the signed-in manager. */
export async function runCardAction({ competition, manager, playerId, action, note, otherPlayerId }) {
  if (!CARD_ACTION_IDS.includes(action)) return refuse("INVALID", "Unknown action.");
  if (!playerId) return refuse("INVALID", "Pick a player.");
  const db = getUltimaDb();
  if (!db) return refuse("UNAVAILABLE");

  const gameweek = await getCurrentGameweek(competition.id);
  const recompute = () => (gameweek?.id ? recomputeGameweekScores(competition.id, gameweek.id) : null);

  switch (action) {
    case "shortlist_on":
    case "shortlist_off":
      return setWatchlist({ managerId: manager.id, playerId, on: action === "shortlist_on" });

    case "untouchable_on":
    case "untouchable_off":
      return setUntouchable({ managerId: manager.id, playerId, on: action === "untouchable_on" });

    case "list":
      return setBlockStance({
        competitionId: competition.id,
        managerId: manager.id,
        playerId,
        stance: "listed",
        note: cleanListNote(note),
      });
    case "unlist":
      return setBlockStance({ competitionId: competition.id, managerId: manager.id, playerId, stance: null });

    case "captain_on": {
      if (!gameweek) return refuse("NO_GAMEWEEK");
      const result = await setCaptain({ managerId: manager.id, gameweekId: gameweek.id, gameweek, playerId });
      if (!result.ok) return result;
      await recompute();
      return { ...result, receipt: captainReceipt({ player: await playerNameOf(playerId) }) };
    }
    case "captain_off": {
      const result = await removeCaptain({ managerId: manager.id, gameweekId: gameweek?.id, gameweek, playerId });
      if (!result.ok) return result;
      await recompute();
      return { ...result, receipt: captainOffReceipt({ player: await playerNameOf(playerId) }) };
    }

    case "xv_in":
    case "xv_out": {
      if (!gameweek) return refuse("NO_GAMEWEEK");
      const roster = await getManagerRoster(manager.id);
      const player = roster.find((p) => p.id === playerId);
      if (!player) return refuse("NOT_OWNED");
      const lineup = await getLineup(manager.id, gameweek.id);
      const prev = await getPrevCaptains(manager.id, gameweek);
      const { lineup: current } = withResolvedCaptains(lineup, prev);
      let slots = current;
      if (action === "xv_out") {
        const row = current.find((r) => r.player_id === playerId);
        if (!row) return { ok: true };
        slots = current.map((r) => (r.slot === row.slot ? { ...r, player_id: null } : r));
      } else {
        if (current.some((r) => r.player_id === playerId)) return { ok: true };
        const free = current.find((r) => r.slot_group === player.league && !r.player_id);
        if (!free) return refuse("FLOOR_VIOLATION", "Your XV is full in that country. Bench someone first.");
        slots = current.map((r) => (r.slot === free.slot ? { ...r, player_id: playerId } : r));
      }
      const result = await saveLineup({ managerId: manager.id, gameweekId: gameweek.id, slots, gameweek });
      if (!result.ok) return result;
      await recompute();
      const receipt = action === "xv_in" ? startedReceipt({ player }) : benchedReceipt({ player });
      return { ...result, receipt };
    }

    case "sign":
    case "drop_sign": {
      // sign: playerId is the free agent, otherPlayerId goes. drop_sign: the reverse.
      const addPlayerId = action === "sign" ? playerId : otherPlayerId;
      const dropPlayerId = action === "sign" ? otherPlayerId : playerId;
      if (!addPlayerId || !dropPlayerId) return refuse("INVALID", "Pick who goes.");
      const result = await addDropTransaction({
        managerId: manager.id,
        addPlayerId,
        dropPlayerId,
        gameweekId: gameweek?.id ?? null,
      });
      if (!result.ok) return result;
      await recompute();
      return { ...result, receipt: signedReceipt({ added: result.added, dropped: result.dropped }) };
    }
    default:
      return refuse("INVALID");
  }
}
