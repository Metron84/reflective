import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { getManagerEmailsForCompetition } from "@/lib/ultima/server/managers";
import { notifyDraftReminderAsync, notifyXiReminderAsync } from "@/lib/ultima/server/notify";
import { isXiComplete } from "@/lib/ultima/lineup/slots";
import { getLineup } from "@/lib/ultima/server/lineup";

const MS_24H = 24 * 3600_000;
const MS_1H = 3600_000;
const MS_3H = 3 * 3600_000;

function inWindow(targetMs, windowMs) {
  const now = Date.now();
  const delta = targetMs - now;
  return delta > 0 && delta <= windowMs;
}

/**
 * Send draft scheduled reminders (24h and 1h before scheduled_at).
 */
export async function runDraftReminders(competitionId) {
  const db = getUltimaDb();
  if (!db) return { ok: false };

  const { data: state } = await db
    .from("ultima_draft_state")
    .select("state, scheduled_at")
    .eq("competition_id", competitionId)
    .maybeSingle();

  if (!state || state.state !== "lobby" || !state.scheduled_at) {
    return { ok: true, skipped: true };
  }

  const target = new Date(state.scheduled_at).getTime();
  const managers = await getManagerEmailsForCompetition(competitionId);
  let sent = 0;

  for (const m of managers) {
    if (inWindow(target, MS_24H) && target - Date.now() > MS_1H) {
      notifyDraftReminderAsync({
        managerId: m.managerId,
        competitionId,
        kind: "draft_reminder_24h",
        scheduledAt: state.scheduled_at,
      });
      sent += 1;
    } else if (inWindow(target, MS_1H)) {
      notifyDraftReminderAsync({
        managerId: m.managerId,
        competitionId,
        kind: "draft_reminder_1h",
        scheduledAt: state.scheduled_at,
      });
      sent += 1;
    }
  }

  return { ok: true, sent };
}

/**
 * Remind managers without a complete XV ~3 hours before the first league lock.
 */
export async function runLineupReminders(competitionId) {
  const db = getUltimaDb();
  if (!db) return { ok: false };

  const { data: gameweek } = await db
    .from("ultima_gameweeks")
    .select("*")
    .eq("competition_id", competitionId)
    .in("state", ["upcoming", "live"])
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!gameweek?.league_open_at) return { ok: true, skipped: true };

  const lockTimes = ULTIMA_LEAGUES.map((l) => gameweek.league_open_at[l])
    .filter(Boolean)
    .map((t) => new Date(t).getTime());

  if (!lockTimes.length) return { ok: true, skipped: true };

  const firstLock = Math.min(...lockTimes);
  if (!inWindow(firstLock, MS_3H)) {
    return { ok: true, skipped: true };
  }

  const hoursLeft = Math.max(1, Math.round((firstLock - Date.now()) / 3600_000));

  const { data: managers } = await db
    .from("ultima_managers")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("is_bot", false);

  let sent = 0;
  for (const m of managers ?? []) {
    const lineup = await getLineup(m.id, gameweek.id);
    if (isXiComplete(lineup)) continue;

    notifyXiReminderAsync({
      managerId: m.id,
      gameweekId: gameweek.id,
      hoursLeft,
    });
    sent += 1;
  }

  return { ok: true, sent };
}
