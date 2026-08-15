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

export async function getManagerForUser(userId) {
  const db = getUltimaDb();
  if (!db || !userId) return null;
  return safeResolve(
    db
      .from("ultima_managers")
      .select("*")
      .eq("user_id", userId)
      .eq("is_bot", false)
      .maybeSingle()
      .then(({ data }) => data),
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

export async function seatsRemaining(competitionId) {
  const taken = await countHumanManagers(competitionId);
  return Math.max(0, ULTIMA_MAX_SEATS - taken);
}
