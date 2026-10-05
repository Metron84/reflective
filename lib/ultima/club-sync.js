/**
 * Pure club sync: match by bare Sportmonks player id, never league-prefixed
 * provider_id. League changes can be deferred to the next Friday unlock.
 */

import { ULTIMA_LEAGUES, ULTIMA_SQUAD_FLOOR_PER_LEAGUE, leagueLabel } from "@/lib/ultima/constants";

export const LEFT_FIVE_REASON = "Left the five leagues";

/** Bare Sportmonks player id from a stored or fresh row. */
export function bareSportmonksId(row) {
  const fromMetrics = row?.seed_metrics?.sportmonks_player_id ?? row?.sportmonks_player_id;
  if (fromMetrics != null && Number.isFinite(Number(fromMetrics))) return Number(fromMetrics);
  const m = String(row?.provider_id ?? "").match(/^sm-[a-z0-9]+-(\d+)$/i);
  return m ? Number(m[1]) : null;
}

/**
 * Compare stored pool to the current five-league squads.
 *
 * @param {object} args
 * @param {Array} args.existing stored ultima_players rows
 * @param {Array} args.fresh provider rows (one current club each)
 * @param {boolean} args.applyLeagueNow true on Friday GST unlock day
 * @param {Map<string, { managerId: string, teamName: string, managerName: string }>} [args.owners]
 *   player uuid → owner
 */
export function diffClubSync({ existing, fresh, applyLeagueNow = false, owners = new Map() }) {
  const bySm = new Map();
  for (const row of existing ?? []) {
    const sm = bareSportmonksId(row);
    if (sm == null) continue;
    // One row per Sportmonks id. Prefer the active row if duplicates exist.
    const prev = bySm.get(sm);
    if (!prev || (prev.active === false && row.active !== false)) bySm.set(sm, row);
  }

  const incoming = new Map();
  for (const row of fresh ?? []) {
    const sm = bareSportmonksId(row);
    if (sm == null) continue;
    incoming.set(sm, row);
  }

  const moved = [];
  const loans = [];
  const departures = [];
  const added = [];
  const patches = [];

  for (const [sm, next] of incoming) {
    const old = bySm.get(sm);
    if (!old) {
      added.push({
        sportmonks_player_id: sm,
        name: next.name,
        club: next.club,
        league: next.league,
        on_loan: Boolean(next.on_loan),
        parent_club: next.parent_club ?? null,
      });
      patches.push({
        kind: "insert",
        sportmonks_player_id: sm,
        row: next,
      });
      continue;
    }

    const clubChanged = (old.club ?? "") !== (next.club ?? "");
    const leagueChanged = old.league !== next.league;
    const loanChanged =
      Boolean(old.on_loan) !== Boolean(next.on_loan) ||
      (old.parent_club ?? null) !== (next.parent_club ?? null);
    const wasInactive = old.active === false || old.inactive_flag === true;

    if (!clubChanged && !leagueChanged && !loanChanged && !wasInactive) continue;

    const owner = owners.get(old.id) ?? null;
    const pendingLeague = old.seed_metrics?.pending_league ?? null;

    let leaguePatch = old.league;
    let nextPending = pendingLeague;
    let deferredLeague = false;

    if (leagueChanged) {
      if (applyLeagueNow) {
        leaguePatch = next.league;
        nextPending = null;
      } else {
        leaguePatch = old.league;
        nextPending = next.league;
        deferredLeague = true;
      }
    } else if (pendingLeague && applyLeagueNow) {
      leaguePatch = pendingLeague;
      nextPending = null;
    } else if (pendingLeague && pendingLeague === next.league && !applyLeagueNow) {
      nextPending = pendingLeague;
    }

    const patch = {
      kind: "update",
      id: old.id,
      sportmonks_player_id: sm,
      provider_id: old.provider_id,
      name: next.name ?? old.name,
      club: next.club,
      league: leaguePatch,
      on_loan: Boolean(next.on_loan),
      parent_club: next.on_loan ? (next.parent_club ?? null) : null,
      active: true,
      inactive_flag: false,
      inactive_reason: null,
      pending_league: nextPending,
      league_moved_from: null,
      league_moved_to: null,
      deferredLeague,
      owner,
    };

    if (applyLeagueNow && leagueChanged) {
      patch.league_moved_from = old.league;
      patch.league_moved_to = next.league;
    } else if (applyLeagueNow && pendingLeague && pendingLeague !== old.league) {
      patch.league_moved_from = old.league;
      patch.league_moved_to = pendingLeague;
      patch.league = pendingLeague;
      patch.pending_league = null;
    }

    patches.push(patch);

    if (clubChanged || leagueChanged || deferredLeague) {
      moved.push({
        id: old.id,
        sportmonks_player_id: sm,
        name: old.name,
        fromClub: old.club,
        toClub: next.club,
        fromLeague: old.league,
        toLeague: next.league,
        deferredLeague,
        owned: Boolean(owner),
        owner,
      });
    }

    if (loanChanged) {
      loans.push({
        id: old.id,
        sportmonks_player_id: sm,
        name: old.name,
        club: next.club,
        on_loan: Boolean(next.on_loan),
        parent_club: next.on_loan ? (next.parent_club ?? null) : null,
        owned: Boolean(owner),
        owner,
      });
    }
  }

  for (const [sm, old] of bySm) {
    if (incoming.has(sm)) continue;
    if (old.active === false && old.inactive_flag === true) continue;
    const owner = owners.get(old.id) ?? null;
    departures.push({
      id: old.id,
      sportmonks_player_id: sm,
      name: old.name,
      club: old.club,
      league: old.league,
      owned: Boolean(owner),
      owner,
    });
    patches.push({
      kind: "depart",
      id: old.id,
      sportmonks_player_id: sm,
      provider_id: old.provider_id,
      name: old.name,
      reason: LEFT_FIVE_REASON,
      owner,
    });
  }

  const sortOwnedFirst = (a, b) => Number(b.owned) - Number(a.owned) || a.name.localeCompare(b.name);
  moved.sort(sortOwnedFirst);
  loans.sort(sortOwnedFirst);
  departures.sort(sortOwnedFirst);

  return {
    moved,
    loans,
    departures,
    added,
    patches,
    counts: {
      moved: moved.length,
      loans: loans.length,
      departures: departures.length,
      added: added.length,
      ownedMoved: moved.filter((m) => m.owned).length,
    },
  };
}

/** Apply pending_league when Friday unlock hits, even if the club did not change again. */
export function pendingLeaguePatches(existing, { applyLeagueNow = false, owners = new Map() } = {}) {
  if (!applyLeagueNow) return [];
  const out = [];
  for (const old of existing ?? []) {
    const pending = old.seed_metrics?.pending_league;
    if (!pending || pending === old.league) continue;
    if (!ULTIMA_LEAGUES.includes(pending)) continue;
    const owner = owners.get(old.id) ?? null;
    out.push({
      kind: "update",
      id: old.id,
      sportmonks_player_id: bareSportmonksId(old),
      provider_id: old.provider_id,
      name: old.name,
      club: old.club,
      league: pending,
      on_loan: Boolean(old.on_loan),
      parent_club: old.parent_club ?? null,
      active: old.active !== false,
      inactive_flag: Boolean(old.inactive_flag),
      inactive_reason: old.inactive_reason ?? null,
      pending_league: null,
      league_moved_from: old.league,
      league_moved_to: pending,
      deferredLeague: false,
      owner,
      pendingOnly: true,
    });
  }
  return out;
}

/** Squad-page notice after a league move left a floor gap. */
export function floorMoveNotice(player, counts) {
  const from = player?.seed_metrics?.league_moved_from;
  if (!from || !ULTIMA_LEAGUES.includes(from)) return null;
  const n = counts?.[from] ?? 0;
  if (n >= ULTIMA_SQUAD_FLOOR_PER_LEAGUE) return null;
  const to = player?.seed_metrics?.league_moved_to ?? player.league;
  return `${player.name} moved to ${leagueLabel(to)}. You have ${n} ${leagueLabel(from)} players, need ${ULTIMA_SQUAD_FLOOR_PER_LEAGUE}.`;
}

export function floorMoveNotices(roster) {
  const counts = Object.fromEntries(ULTIMA_LEAGUES.map((l) => [l, 0]));
  for (const p of roster ?? []) {
    if (p.league in counts) counts[p.league] += 1;
  }
  const notices = [];
  for (const p of roster ?? []) {
    const line = floorMoveNotice(p, counts);
    if (line) notices.push(line);
  }
  return notices;
}
