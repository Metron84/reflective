import { getServiceClient } from "@/lib/supabase";
import { ULTIMA_MAX_SEATS } from "@/lib/ultima/constants";
import { safeResolve } from "@/lib/ultima/server/safe";

export function getUltimaDb() {
  return getServiceClient();
}

export async function getActiveCompetition() {
  const db = getUltimaDb();
  if (!db) return null;
  return safeResolve(
    db
      .from("ultima_competition")
      .select("*")
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => data),
  );
}

export async function countHumanManagers(competitionId) {
  const db = getUltimaDb();
  if (!db) return 0;
  const { count } = await db
    .from("ultima_managers")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId)
    .eq("is_bot", false);
  return count ?? 0;
}

export async function getManagerForUser(userId, competitionId = null) {
  const db = getUltimaDb();
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
}

export async function getManagerCompetitionId(managerId) {
  const db = getUltimaDb();
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

  const db = getUltimaDb();
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
