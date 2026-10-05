import { cache } from "react";
import { getServiceClient } from "@/lib/supabase";
import { ULTIMA_MAX_SEATS } from "@/lib/ultima/constants";
import { resolveSeatState } from "@/lib/ultima/server/seat-state";
import { safeResolve } from "@/lib/ultima/server/safe";
import { loggedDb, logReadError } from "@/lib/ultima/server/strict-db";

export function getUltimaDb() {
  return getServiceClient();
}

export const getActiveCompetition = cache(async function getActiveCompetition() {
  const db = getUltimaDb();
  if (!db) return null;
  return safeResolve(
    db
      .from("ultima_competition")
      .select("*")
      .eq("is_active", true)
      .eq("kind", "season")
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) logReadError("getActiveCompetition", "ultima_competition", error);
        return data;
      }),
  );
});

/** The active season, or a throw when the read fails. For pages that must say "did not load". */
export const getActiveCompetitionStrict = cache(async function getActiveCompetitionStrict() {
  const db = getUltimaDb();
  if (!db) return null;
  const { data, error } = await db
    .from("ultima_competition")
    .select("*")
    .eq("is_active", true)
    .eq("kind", "season")
    .maybeSingle();
  if (error) {
    console.error("[ultima/read] ultima_competition", error.message);
    throw new Error("Could not read the active competition.");
  }
  return data;
});

export async function countHumanManagers(competitionId, { strict = false } = {}) {
  const db = loggedDb(getUltimaDb(), "countHumanManagers");
  if (!db) return 0;
  const { count, error } = await db
    .from("ultima_managers")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId)
    .eq("is_bot", false);
  if (error && strict) {
    console.error("[ultima/read] ultima_managers count", error.message);
    throw new Error("Could not count managers.");
  }
  return count ?? 0;
}

export const getManagerForUser = cache(async function getManagerForUser(
  userId,
  competitionId = null,
) {
  const db = loggedDb(getUltimaDb(), "getManagerForUser");
  if (!db || !userId) return null;

  const scopedId = competitionId ?? (await getActiveCompetition())?.id;
  if (!scopedId) return null;

  return safeResolve(
    db
      .from("ultima_managers")
      .select("*")
      .eq("user_id", userId)
      .eq("is_bot", false)
      .eq("competition_id", scopedId)
      .maybeSingle()
      .then(({ data }) => data),
  );
});

export async function getManagerCompetitionId(managerId) {
  const db = loggedDb(getUltimaDb(), "getManagerCompetitionId");
  if (!db || !managerId) return null;

  return safeResolve(
    db
      .from("ultima_managers")
      .select("competition_id")
      .eq("id", managerId)
      .maybeSingle()
      .then(({ data }) => data?.competition_id ?? null),
  );
}

export function isCommissionerUser(userId) {
  if (!userId) return false;
  const raw = process.env.ULTIMA_COMMISSIONER_USER_IDS ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

/**
 * Commissioner rights come from the env list or from being a site admin.
 * The database flag is the same in every environment, so it survives the
 * env var only reaching some deployments.
 */
export async function isUltimaCommissioner(userId) {
  if (!userId) return false;
  if (isCommissionerUser(userId)) return true;

  const db = loggedDb(getUltimaDb(), "isUltimaCommissioner");
  if (!db) return false;

  return safeResolve(
    db
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => Boolean(data?.is_admin)),
    false,
  );
}

export async function seatsRemaining(competitionId) {
  const taken = await countHumanManagers(competitionId);
  return Math.max(0, ULTIMA_MAX_SEATS - taken);
}

export const lookupSeat = cache(async function lookupSeat(userId) {
  return resolveSeatState(getUltimaDb(), userId);
});
