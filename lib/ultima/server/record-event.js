import { getUltimaDb } from "@/lib/ultima/server/db";

export async function recordUltimaEvent({
  event,
  managerId = null,
  competitionId = null,
  payload = {},
}) {
  const db = getUltimaDb();
  if (!db || !event) return;

  let scopedCompetitionId = competitionId;
  if (!scopedCompetitionId && managerId) {
    const { data } = await db
      .from("ultima_managers")
      .select("competition_id")
      .eq("id", managerId)
      .maybeSingle();
    scopedCompetitionId = data?.competition_id ?? null;
  }

  await db.from("ultima_events").insert({
    event,
    manager_id: managerId,
    competition_id: scopedCompetitionId,
    payload,
  });
}
