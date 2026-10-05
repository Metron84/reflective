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

function sortOwnedFirst(a, b) {
  return Number(b.owned) - Number(a.owned) || String(a.name).localeCompare(String(b.name));
}

/**
 * Compare stored pool to the current five-league squads.
 */
export function diffClubSync({ existing, fresh, applyLeagueNow = false, owners = new Map() }) {
  const bySm = new Map();
  for (const row of existing ?? []) {
    const sm = bareSportmonksId(row);
    if (sm == null) continue;
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
      destinationClub: null,
    });
    patches.push({
      kind: "depart",
      id: old.id,
      sportmonks_player_id: sm,
      provider_id: old.provider_id,
      name: old.name,
      reason: LEFT_FIVE_REASON,
      owner,
      destinationClub: null,
    });
  }

  moved.sort(sortOwnedFirst);
  loans.sort(sortOwnedFirst);
  departures.sort(sortOwnedFirst);
  added.sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const { clubMoves, leaguePending } = splitMovePreview(moved);

  return {
    moved,
    clubMoves,
    leaguePending,
    loans,
    departures,
    added,
    patches,
    counts: {
      clubMoves: clubMoves.length,
      leaguePending: leaguePending.length,
      moved: moved.length,
      loans: loans.length,
      departures: departures.length,
      added: added.length,
      ownedMoved: moved.filter((m) => m.owned).length,
    },
  };
}

/** Club moves now vs league changes waiting for (or applying on) Friday. */
export function splitMovePreview(moved) {
  const clubMoves = [];
  const leaguePending = [];
  for (const m of moved ?? []) {
    if ((m.fromClub ?? "") !== (m.toClub ?? "")) clubMoves.push(m);
    if (m.deferredLeague || m.pendingOnly || m.appliedNow) leaguePending.push(m);
    else if (m.fromLeague && m.toLeague && m.fromLeague !== m.toLeague && !m.deferredLeague) {
      // Friday apply: league changed in the same patch as the club update.
      leaguePending.push({ ...m, appliedNow: true });
    }
  }
  clubMoves.sort(sortOwnedFirst);
  leaguePending.sort(sortOwnedFirst);
  return { clubMoves, leaguePending };
}

/**
 * For owned players missing from squad pulls: use a direct Sportmonks team
 * lookup. In the five leagues → treat as a club update. Confirmed outside →
 * depart with destination. Lookup miss → leave alone (do not mark inactive).
 *
 * @param {object} args
 * @param {Array} args.departures
 * @param {Array} args.patches
 * @param {Map<number, { teamId: number, teamName: string } | null>} args.lookups
 * @param {Map<number, { league: string, club: string }>} args.teamById
 * @param {Map<string, object>} args.existingById
 * @param {boolean} args.applyLeagueNow
 */
export function reconcileOwnedDepartures({
  departures,
  patches,
  lookups,
  teamById,
  existingById,
  applyLeagueNow = false,
}) {
  const nextDepartures = [];
  const rescuedMoves = [];
  const nextPatches = [];
  const dropDepartIds = new Set();

  for (const dep of departures ?? []) {
    if (!dep.owned) {
      nextDepartures.push(dep);
      continue;
    }

    const found = lookups.get(dep.sportmonks_player_id);
    if (found === undefined) {
      // Not looked up; keep as departure (unowned path). Should not happen for owned.
      nextDepartures.push(dep);
      continue;
    }
    if (found == null || found.teamId == null) {
      // Not confirmed outside the five leagues: do not mark inactive.
      dropDepartIds.add(dep.id);
      continue;
    }

    const inFive = teamById.get(Number(found.teamId));
    if (inFive) {
      dropDepartIds.add(dep.id);
      const old = existingById.get(dep.id);
      if (!old) continue;

      const leagueChanged = old.league !== inFive.league;
      let leaguePatch = old.league;
      let nextPending = old.seed_metrics?.pending_league ?? null;
      let deferredLeague = false;
      if (leagueChanged) {
        if (applyLeagueNow) {
          leaguePatch = inFive.league;
          nextPending = null;
        } else {
          nextPending = inFive.league;
          deferredLeague = true;
        }
      }

      const move = {
        id: old.id,
        sportmonks_player_id: dep.sportmonks_player_id,
        name: old.name,
        fromClub: old.club,
        toClub: inFive.club,
        fromLeague: old.league,
        toLeague: inFive.league,
        deferredLeague,
        owned: true,
        owner: dep.owner,
        rescuedFromGap: true,
      };
      rescuedMoves.push(move);

      nextPatches.push({
        kind: "update",
        id: old.id,
        sportmonks_player_id: dep.sportmonks_player_id,
        provider_id: old.provider_id,
        name: old.name,
        club: inFive.club,
        league: leaguePatch,
        on_loan: Boolean(old.on_loan),
        parent_club: old.parent_club ?? null,
        active: true,
        inactive_flag: false,
        inactive_reason: null,
        pending_league: nextPending,
        league_moved_from: applyLeagueNow && leagueChanged ? old.league : null,
        league_moved_to: applyLeagueNow && leagueChanged ? inFive.league : null,
        deferredLeague,
        owner: dep.owner,
      });
      continue;
    }

    nextDepartures.push({
      ...dep,
      destinationClub: found.teamName ?? null,
    });
  }

  for (const patch of patches ?? []) {
    if (patch.kind === "depart" && dropDepartIds.has(patch.id)) continue;
    if (patch.kind === "depart") {
      const dep = nextDepartures.find((d) => d.id === patch.id);
      nextPatches.push({
        ...patch,
        destinationClub: dep?.destinationClub ?? patch.destinationClub ?? null,
      });
      continue;
    }
    nextPatches.push(patch);
  }

  nextDepartures.sort(sortOwnedFirst);
  rescuedMoves.sort(sortOwnedFirst);

  return {
    departures: nextDepartures,
    rescuedMoves,
    patches: nextPatches,
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
