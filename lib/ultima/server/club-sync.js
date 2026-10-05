/**
 * Club sync against current Sportmonks squads. Match by bare Sportmonks player
 * id. Club and loan update immediately; league waits for Friday GST unlock.
 */

import {
  LEFT_FIVE_REASON,
  bareSportmonksId,
  diffClubSync,
  pendingLeaguePatches,
} from "@/lib/ultima/club-sync";
import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { isGstFriday } from "@/lib/ultima/gst";
import {
  getProviderDiagnostics,
  getProviderName,
  getProviderStatsCoverage,
  syncAllPlayersFromProvider,
} from "@/lib/ultima/provider/index";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { seasonDraftInProgress } from "@/lib/ultima/server/players";

const PAGE_SIZE = 1000;
const WRITE_CHUNK = 80;

async function fetchAllPlayers(db) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("ultima_players")
      .select(
        "id, provider_id, name, league, club, active, inactive_flag, inactive_reason, on_loan, parent_club, seed_metrics, draft_round, bolt_eligible",
      )
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function loadOwners(db) {
  const { data: season } = await db
    .from("ultima_competition")
    .select("id")
    .eq("is_active", true)
    .eq("kind", "season")
    .maybeSingle();
  if (!season?.id) return new Map();

  const owners = new Map();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("ultima_rosters")
      .select("player_id, manager_id, ultima_managers(id, team_name, manager_name)")
      .eq("competition_id", season.id)
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data?.length) break;
    for (const row of data) {
      const m = row.ultima_managers;
      owners.set(row.player_id, {
        managerId: row.manager_id,
        teamName: m?.team_name ?? null,
        managerName: m?.manager_name ?? null,
      });
    }
    if (data.length < PAGE_SIZE) break;
  }
  return owners;
}

function mergeSeedMetrics(oldMetrics, patch) {
  const next = { ...(oldMetrics ?? {}) };
  if (patch.sportmonks_player_id != null) {
    next.sportmonks_player_id = patch.sportmonks_player_id;
  }
  if (patch.pending_league) next.pending_league = patch.pending_league;
  else delete next.pending_league;

  if (patch.league_moved_from && patch.league_moved_to) {
    next.league_moved_from = patch.league_moved_from;
    next.league_moved_to = patch.league_moved_to;
    next.league_moved_at = patch.syncedAt;
  }
  return next;
}

function insertRow(fresh, syncedAt) {
  return {
    provider_id: fresh.provider_id,
    name: fresh.name,
    league: fresh.league,
    club: fresh.club,
    active: true,
    inactive_flag: false,
    inactive_reason: null,
    on_loan: Boolean(fresh.on_loan),
    parent_club: fresh.on_loan ? (fresh.parent_club ?? null) : null,
    club_synced_at: syncedAt,
    bolt_eligible: true,
    draft_round: null,
    seed_metrics: {
      goals_rate: fresh.goals_rate ?? 0,
      assists_rate: fresh.assists_rate ?? 0,
      rating_avg: fresh.rating_avg ?? 0,
      rating_consistency: fresh.rating_consistency ?? 0,
      minutes_reliability: fresh.minutes_reliability ?? 0,
      club_strength: fresh.club_strength ?? 0,
      sportmonks_player_id: fresh.sportmonks_player_id ?? bareSportmonksId(fresh),
    },
  };
}

async function applyPatches(db, patches, existingById, syncedAt) {
  const errors = [];

  for (let i = 0; i < patches.length; i += WRITE_CHUNK) {
    const chunk = patches.slice(i, i + WRITE_CHUNK);
    for (const patch of chunk) {
      if (patch.kind === "insert") {
        const { error } = await db.from("ultima_players").insert(insertRow(patch.row, syncedAt));
        if (error) errors.push({ kind: "insert", name: patch.row?.name, error: error.message });
        continue;
      }

      if (patch.kind === "depart") {
        const { error } = await db
          .from("ultima_players")
          .update({
            active: false,
            inactive_flag: true,
            inactive_reason: LEFT_FIVE_REASON,
            club_synced_at: syncedAt,
          })
          .eq("id", patch.id);
        if (error) errors.push({ kind: "depart", id: patch.id, error: error.message });
        continue;
      }

      const old = existingById.get(patch.id);
      const seed = mergeSeedMetrics(old?.seed_metrics, { ...patch, syncedAt });
      const { error } = await db
        .from("ultima_players")
        .update({
          name: patch.name,
          club: patch.club,
          league: patch.league,
          on_loan: patch.on_loan,
          parent_club: patch.parent_club,
          active: patch.active,
          inactive_flag: patch.inactive_flag,
          inactive_reason: patch.inactive_reason,
          club_synced_at: syncedAt,
          seed_metrics: seed,
        })
        .eq("id", patch.id);
      if (error) errors.push({ kind: "update", id: patch.id, error: error.message });
    }
  }

  return errors;
}

function previewPayload(diff) {
  const ownerLine = (owner) =>
    owner ? owner.teamName || owner.managerName || owner.managerId : null;

  return {
    moved: diff.moved.map((m) => ({
      name: m.name,
      fromClub: m.fromClub,
      toClub: m.toClub,
      fromLeague: m.fromLeague,
      toLeague: m.toLeague,
      deferredLeague: m.deferredLeague,
      owned: m.owned,
      owner: ownerLine(m.owner),
    })),
    loans: diff.loans.map((m) => ({
      name: m.name,
      club: m.club,
      on_loan: m.on_loan,
      parent_club: m.parent_club,
      owned: m.owned,
      owner: ownerLine(m.owner),
    })),
    departures: diff.departures.map((m) => ({
      name: m.name,
      club: m.club,
      league: m.league,
      owned: m.owned,
      owner: ownerLine(m.owner),
      reason: LEFT_FIVE_REASON,
    })),
    added: diff.added.map((m) => ({
      name: m.name,
      club: m.club,
      league: m.league,
      on_loan: m.on_loan,
      parent_club: m.parent_club,
    })),
    counts: diff.counts,
  };
}

/**
 * Preview or apply club sync for all five leagues.
 * @param {{ dryRun?: boolean, now?: Date }} [opts]
 */
export async function syncClubs({ dryRun = false, now = new Date() } = {}) {
  const db = getUltimaDb();
  if (!db) return { ok: false, error: "no_db" };

  if (await seasonDraftInProgress(db)) {
    return {
      ok: false,
      error: "draft_in_progress",
      message: "The draft is in progress. Club sync is frozen.",
    };
  }

  const provider = getProviderName();
  const fresh = await syncAllPlayersFromProvider();
  const reasons = getProviderDiagnostics();
  const coverage = getProviderStatsCoverage();

  if (!fresh.length) {
    return {
      ok: false,
      error: "empty_pool",
      provider,
      reasons,
      coverage,
      message: "Provider returned no squads.",
    };
  }

  // One current club per Sportmonks id. If a name appears twice, keep the first.
  const deduped = new Map();
  for (const p of fresh) {
    const sm = bareSportmonksId(p);
    if (sm == null) continue;
    if (!deduped.has(sm)) deduped.set(sm, p);
  }
  const freshList = [...deduped.values()];

  const existing = await fetchAllPlayers(db);
  const owners = await loadOwners(db);
  const applyLeagueNow = isGstFriday(now);

  const pending = pendingLeaguePatches(existing, { applyLeagueNow, owners });
  const diff = diffClubSync({
    existing,
    fresh: freshList,
    applyLeagueNow,
    owners,
  });

  // Pending-only patches that the fresh pull did not already cover.
  const covered = new Set(diff.patches.filter((p) => p.kind === "update").map((p) => p.id));
  for (const p of pending) {
    if (!covered.has(p.id)) {
      diff.patches.push(p);
      diff.moved.push({
        id: p.id,
        sportmonks_player_id: p.sportmonks_player_id,
        name: p.name,
        fromClub: p.club,
        toClub: p.club,
        fromLeague: p.league_moved_from,
        toLeague: p.league_moved_to,
        deferredLeague: false,
        owned: Boolean(p.owner),
        owner: p.owner,
      });
      diff.counts.moved += 1;
      if (p.owner) diff.counts.ownedMoved += 1;
    }
  }

  const preview = previewPayload(diff);
  const syncedAt = now.toISOString();

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      provider,
      applyLeagueNow,
      reasons,
      coverage,
      fresh: freshList.length,
      stored: existing.length,
      ...preview,
    };
  }

  const existingById = new Map(existing.map((r) => [r.id, r]));
  const errors = await applyPatches(db, diff.patches, existingById, syncedAt);

  return {
    ok: errors.length === 0,
    dryRun: false,
    provider,
    applyLeagueNow,
    reasons,
    coverage,
    fresh: freshList.length,
    stored: existing.length,
    errors: errors.length ? errors.slice(0, 12) : undefined,
    ...preview,
    leagues: ULTIMA_LEAGUES,
  };
}
