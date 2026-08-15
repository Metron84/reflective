import { getServiceClient } from "@/lib/supabase";
import { getUltimaDb } from "@/lib/ultima/server/db";

/**
 * Resolve a manager's email via Supabase Auth admin (server only).
 */
export async function getManagerEmail(managerId) {
  const db = getUltimaDb();
  const admin = getServiceClient();
  if (!db || !admin || !managerId) return null;

  const { data: manager } = await db
    .from("ultima_managers")
    .select("user_id, is_bot, team_name")
    .eq("id", managerId)
    .maybeSingle();

  if (!manager?.user_id || manager.is_bot) return null;

  const { data, error } = await admin.auth.admin.getUserById(manager.user_id);
  if (error || !data?.user?.email) return null;

  return {
    email: data.user.email,
    teamName: manager.team_name,
  };
}

export async function getHumanManagers(competitionId) {
  const db = getUltimaDb();
  if (!db) return [];

  const { data } = await db
    .from("ultima_managers")
    .select("id, user_id, team_name, is_bot")
    .eq("competition_id", competitionId)
    .eq("is_bot", false);

  return data ?? [];
}

export async function getManagerEmailsForCompetition(competitionId) {
  const managers = await getHumanManagers(competitionId);
  const rows = [];
  for (const m of managers) {
    const info = await getManagerEmail(m.id);
    if (info?.email) rows.push({ managerId: m.id, ...info });
  }
  return rows;
}
