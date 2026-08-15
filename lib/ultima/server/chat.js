import { getUltimaDb } from "@/lib/ultima/server/db";
import { publishUltimaEvent } from "@/lib/ultima/server/events";

const MAX_BODY = 280;
const hits = new Map();

export function chatRateLimited(managerId) {
  const now = Date.now();
  const recent = (hits.get(managerId) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(managerId, recent);
  return recent.length > 20;
}

export function sanitizeChatBody(raw) {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_BODY);
}

export async function listChatMessages(competitionId, limit = 40) {
  const db = getUltimaDb();
  if (!db || !competitionId) return [];

  const { data, error } = await db
    .from("ultima_chat_messages")
    .select("id, body, created_at, manager_id, ultima_managers(team_name, manager_name)")
    .eq("competition_id", competitionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];

  return (data ?? []).reverse().map((row) => ({
    id: row.id,
    body: row.body,
    at: row.created_at,
    manager_id: row.manager_id,
    team_name: row.ultima_managers?.team_name ?? "Manager",
  }));
}

export async function postChatMessage({ competitionId, managerId, body }) {
  const text = sanitizeChatBody(body);
  if (!text) return { ok: false, code: "INVALID", message: "Write something first." };

  const db = getUltimaDb();
  if (!db) return { ok: false, code: "UNAVAILABLE" };

  const { data, error } = await db
    .from("ultima_chat_messages")
    .insert({
      competition_id: competitionId,
      manager_id: managerId,
      body: text,
    })
    .select("id, body, created_at, manager_id")
    .single();

  if (error || !data) {
    return { ok: false, code: "UNAVAILABLE", message: error?.message };
  }

  publishUltimaEvent("chat.message", {
    competition_id: competitionId,
    manager_id: managerId,
    id: data.id,
  });

  return { ok: true, message: data };
}
