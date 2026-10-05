import { withTimeout } from "@/lib/ultima/server/safe";

const SEAT_QUERY_MS = 4000;

async function readOnce(query) {
  const { data, error } = await withTimeout(query, SEAT_QUERY_MS);
  if (error) throw error;
  return data;
}

/**
 * Seat lookup that never mistakes a failed query for "no seat".
 * Retries once, then reports `unavailable`.
 * Result: seated | no-seat (with the draft state) | unavailable.
 */
export async function resolveSeatState(db, userId) {
  if (!db || !userId) return { status: "unavailable" };

  const attempt = async () => {
    const competition = await readOnce(
      db
        .from("ultima_competition")
        .select("*")
        .eq("is_active", true)
        .eq("kind", "season")
        .maybeSingle(),
    );
    if (!competition) return { status: "unavailable" };

    const manager = await readOnce(
      db
        .from("ultima_managers")
        .select("*")
        .eq("user_id", userId)
        .eq("is_bot", false)
        .eq("competition_id", competition.id)
        .maybeSingle(),
    );
    if (manager) return { status: "seated", competition, manager };

    const draft = await readOnce(
      db
        .from("ultima_draft_state")
        .select("state")
        .eq("competition_id", competition.id)
        .maybeSingle(),
    );
    return {
      status: "no-seat",
      competition,
      draftState: draft?.state ?? "lobby",
    };
  };

  try {
    return await attempt();
  } catch {
    try {
      return await attempt();
    } catch {
      return { status: "unavailable" };
    }
  }
}
