import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { forcedLeagues, wouldBreakFloor } from "@/lib/ultima/draft/floor";
import { getStatsProvider } from "@/lib/ultima/provider/index";

/**
 * Score available players for a bot persona pick.
 */
export function scorePlayerForBot(player, persona, context) {
  const m = player.seed_metrics ?? player;
  const weights = persona.weights ?? {};
  let score = 0;
  score += (m.goals_rate ?? 0) * (weights.goals_rate ?? 0);
  score += (m.assists_rate ?? 0) * (weights.assists_rate ?? 0);
  score += (m.rating_avg ?? 0) * (weights.rating_avg ?? 0);
  score += (1 - (m.rating_consistency ?? 0)) * (weights.rating_consistency ?? 0);
  score += (m.minutes_reliability ?? 0) * (weights.minutes_reliability ?? 0);
  score += (m.club_strength ?? 0) * (weights.club_strength ?? 0);
  score += (context.draftRound ?? 1) * (weights.draft_round ?? 0) * 0.01;

  // Risk axis: low risk prefers high minutes
  if (persona.risk < 0.5) {
    score += (m.minutes_reliability ?? 0) * (0.5 - persona.risk);
  } else {
    score += (m.goals_rate ?? 0) * persona.risk;
  }

  // Wobble: random override chance
  if (Math.random() < (persona.wobble ?? 0.1)) {
    score += Math.random() * 2;
  }

  return score;
}

export function pickRationale(persona) {
  const lines = persona.rationale_lines ?? [];
  if (!lines.length) return null;
  return lines[Math.floor(Math.random() * lines.length)];
}

/**
 * Rank undrafted candidates for a bot. Caller must pass the LIVE undrafted set.
 * Returns best-first so PICK_TAKEN can fall through to the next candidate.
 */
export function listBotPickCandidates({
  persona,
  availablePlayers,
  managerCounts,
  slotsLeft,
  supplyByLeague,
  queuePlayerIds = [],
  draftRound = 1,
}) {
  const forced = forcedLeagues(managerCounts, slotsLeft);
  let pool = availablePlayers.filter((p) => {
    if (wouldBreakFloor(managerCounts, p.league, slotsLeft, supplyByLeague)) {
      return false;
    }
    if (forced.length && !forced.includes(p.league)) return false;
    return true;
  });

  if (!pool.length) {
    // Forced leagues left an empty set. Prefer any floor-safe player, then any
    // remaining undrafted player so a bot never stalls the clock.
    pool = availablePlayers.filter(
      (p) => !wouldBreakFloor(managerCounts, p.league, slotsLeft, supplyByLeague),
    );
  }
  if (!pool.length) {
    pool = [...availablePlayers];
  }

  const provider = getStatsProvider();
  const rankings = {};
  for (const league of ULTIMA_LEAGUES) {
    rankings[league] = new Map(
      (provider.getRankings(league) ?? []).map((p, i) => [p.provider_id, i]),
    );
  }

  pool.sort((a, b) => {
    const ra = rankings[a.league]?.get(a.provider_id) ?? 999;
    const rb = rankings[b.league]?.get(b.provider_id) ?? 999;
    if (ra !== rb) return ra - rb;
    return (
      scorePlayerForBot(b, persona, { draftRound }) -
      scorePlayerForBot(a, persona, { draftRound })
    );
  });

  const rationale = pickRationale(persona);
  const ranked = pool.map((player) => ({
    player,
    forced: forced.includes(player.league),
    forcedLeague: forced.includes(player.league) ? player.league : null,
    rationale,
  }));

  // Queue first when still undrafted and legal.
  const queued = [];
  const seen = new Set();
  for (const qid of queuePlayerIds) {
    const hit = ranked.find((row) => row.player.id === qid);
    if (hit && !seen.has(hit.player.id)) {
      queued.push(hit);
      seen.add(hit.player.id);
    }
  }

  const rest = ranked.filter((row) => !seen.has(row.player.id));
  return [...queued, ...rest];
}

/**
 * Choose best bot pick from available pool.
 */
export function chooseBotPick(args) {
  const list = listBotPickCandidates(args);
  return list[0] ?? null;
}
