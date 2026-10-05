import { ULTIMA_LEAGUES, ULTIMA_LEAGUE_LABELS } from "@/lib/ultima/constants";
import { resolveCaptains } from "@/lib/ultima/captains";
import {
  gstClock,
  lockReminderDue,
  needsLockReminder,
  offerExpiringDue,
  OFFER_EXPIRING_HOURS,
} from "@/lib/ultima/notifications/rules";
import { LIVE_OFFER_HOURS } from "@/lib/ultima/trades/rules";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { getLineup, getPrevCaptains } from "@/lib/ultima/server/lineup";
import {
  claimOnce,
  createNotifications,
  releaseDuePushes,
} from "@/lib/ultima/server/notifications";
import { expireStaleTrades } from "@/lib/ultima/server/trades";
import { getLoggedDb } from "@/lib/ultima/server/strict-db";

const HOUR_MS = 3_600_000;

/** Receivers of offers that expire inside the next 6 hours. Once per offer. */
export async function runOfferExpiringReminders(competitionId, now = Date.now()) {
  const db = getLoggedDb("notify-cron");
  if (!db || !competitionId) return { reminded: 0 };

  const oldest = new Date(now - LIVE_OFFER_HOURS * HOUR_MS).toISOString();
  const newest = new Date(now - (LIVE_OFFER_HOURS - OFFER_EXPIRING_HOURS) * HOUR_MS).toISOString();
  const { data: trades } = await db
    .from("ultima_trades")
    .select("id, proposer_id, receiver_id, created_at, competition_id")
    .eq("competition_id", competitionId)
    .eq("state", "proposed")
    .gte("created_at", oldest)
    .lte("created_at", newest);

  const due = (trades ?? []).filter((t) => offerExpiringDue(t.created_at, now, LIVE_OFFER_HOURS));
  if (!due.length) return { reminded: 0 };

  const ids = [...new Set(due.map((t) => t.proposer_id))];
  const { data: proposers } = await db.from("ultima_managers").select("id, team_name").in("id", ids);
  const teamById = new Map((proposers ?? []).map((m) => [m.id, m.team_name]));

  const items = [];
  for (const trade of due) {
    if (!(await claimOnce(trade.receiver_id, "n_offer_expiring", trade.id))) continue;
    items.push({
      managerId: trade.receiver_id,
      competitionId,
      kind: "offer_expiring",
      title: "Offer expiring",
      body: `${teamById.get(trade.proposer_id) ?? "A manager"}'s offer expires soon. Answer it.`,
      link: `/ultima/trades/${trade.id}`,
    });
  }
  const { created } = await createNotifications(items, { now });
  return { reminded: created };
}

/**
 * Three hours before each country opens, remind each manager who has an empty
 * XV slot or no captain in that country. Once per manager, country and gameweek.
 */
export async function runLockReminders(competitionId, now = Date.now()) {
  const db = getLoggedDb("notify-cron");
  if (!db || !competitionId) return { reminded: 0 };

  const { data: gameweeks } = await db
    .from("ultima_gameweeks")
    .select("id, number, competition_id, league_open_at, state")
    .eq("competition_id", competitionId)
    .gte("window_end", new Date(now).toISOString())
    .order("number", { ascending: true })
    .limit(3);

  const dueSlots = [];
  for (const gw of gameweeks ?? []) {
    for (const league of ULTIMA_LEAGUES) {
      const openAt = gw.league_open_at?.[league];
      if (openAt && lockReminderDue(openAt, now)) dueSlots.push({ gw, league, openAt });
    }
  }
  if (!dueSlots.length) return { reminded: 0 };

  const { data: managers } = await db
    .from("ultima_managers")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("is_bot", false);

  const items = [];
  for (const manager of managers ?? []) {
    const cache = new Map();
    for (const { gw, league, openAt } of dueSlots) {
      if (!cache.has(gw.id)) {
        const lineup = await getLineup(manager.id, gw.id);
        const prev = await getPrevCaptains(manager.id, gw);
        cache.set(gw.id, { lineup, captains: resolveCaptains(lineup, prev).byLeague });
      }
      const { lineup, captains } = cache.get(gw.id);
      if (!needsLockReminder(lineup, captains[league], league)) continue;
      if (!(await claimOnce(manager.id, "n_lock_reminder", `${gw.id}:${league}`))) continue;

      const issues = [];
      if ((lineup ?? []).some((r) => r.slot_group === league && !r.player_id)) {
        issues.push("Empty XV slot.");
      }
      if (!captains[league]) issues.push("No captain.");
      const label = ULTIMA_LEAGUE_LABELS[league] ?? league;
      items.push({
        managerId: manager.id,
        competitionId,
        kind: "lock_reminder",
        title: `${label} locks soon`,
        body: `${label} locks at ${gstClock(openAt)} GST. ${issues.join(" ")}`.trim(),
        link: "/ultima/squad",
      });
    }
  }
  const { created } = await createNotifications(items, { now });
  return { reminded: created };
}

/**
 * The 15 minute job: expire offers, warn about offers close to expiry, send
 * lock reminders, then send held pushes whose time has come.
 */
export async function runNotifyCron({ now = Date.now() } = {}) {
  const competition = await getActiveCompetition();

  const { expired } = await expireStaleTrades();
  const expiring = competition
    ? await runOfferExpiringReminders(competition.id, now)
    : { reminded: 0 };
  const locks = competition ? await runLockReminders(competition.id, now) : { reminded: 0 };
  const pushes = await releaseDuePushes({ now });

  return {
    ok: true,
    expired: expired.length,
    offerReminders: expiring.reminded,
    lockReminders: locks.reminded,
    pushesReleased: pushes.released ?? 0,
  };
}
