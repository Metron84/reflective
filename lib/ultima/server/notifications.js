import { ULTIMA_LEAGUE_LABELS } from "@/lib/ultima/constants";
import { VOID_REASON_LINE } from "@/lib/ultima/trades/rules";
import {
  categoryForKind,
  isInboxOnly,
  planPush,
  pushAllowed,
  safeLink,
} from "@/lib/ultima/notifications/rules";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { sendWebPush } from "@/lib/ultima/server/push";
import { getReadDb } from "@/lib/ultima/server/strict-db";

/** Push sends share one budget so a slow push service never stalls a request. */
const SEND_BUDGET_MS = 6000;
/** A push still queued after this long never finished. The scheduled job retries it. */
const STUCK_QUEUED_MS = 2 * 60_000;

function safely(label, fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(`[ultima/notifications] ${label} failed:`, error?.message || error);
      return null;
    }
  };
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

async function loadManagers(db, ids) {
  const unique = [...new Set((ids ?? []).filter(Boolean))];
  if (!unique.length) return new Map();
  const { data } = await db
    .from("ultima_managers")
    .select("id, competition_id, team_name, is_bot, notify_prefs")
    .in("id", unique);
  return new Map((data ?? []).map((m) => [m.id, m]));
}

async function humanManagersOf(db, competitionId) {
  if (!competitionId) return [];
  const { data } = await db
    .from("ultima_managers")
    .select("id, competition_id, team_name, is_bot, notify_prefs")
    .eq("competition_id", competitionId)
    .eq("is_bot", false);
  return (data ?? []).filter((m) => !m.is_bot);
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

function pushPayload(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    link: safeLink(row.link),
  };
}

/**
 * Send queued pushes and write each notification's final push_status.
 * A 404 or 410 from the push service deletes that subscription.
 */
async function deliverPushes(db, rows) {
  if (!rows.length) return { sent: 0, failed: 0, skipped: 0, deleted: 0 };

  const managerIds = [...new Set(rows.map((r) => r.manager_id))];
  const { data: subs } = await db
    .from("ultima_push_subscriptions")
    .select("id, manager_id, endpoint, p256dh, auth")
    .in("manager_id", managerIds);
  const byManager = new Map();
  for (const sub of subs ?? []) {
    const list = byManager.get(sub.manager_id) ?? [];
    list.push(sub);
    byManager.set(sub.manager_id, list);
  }

  const tally = { sent: 0, failed: 0, skipped: 0, deleted: 0 };
  const deadEndpoints = new Set();

  await Promise.all(
    rows.map(async (row) => {
      const list = byManager.get(row.manager_id) ?? [];
      let status;
      if (!list.length) {
        status = "skipped";
      } else {
        const results = await Promise.all(
          list.map(async (sub) => ({ sub, res: await sendWebPush(sub, pushPayload(row)) })),
        );
        const okSubs = results.filter((r) => r.res.ok).map((r) => r.sub);
        for (const r of results) if (r.res.gone) deadEndpoints.add(r.sub.endpoint);
        if (okSubs.length) {
          status = "sent";
          await db
            .from("ultima_push_subscriptions")
            .update({ last_ok_at: new Date().toISOString() })
            .in("endpoint", okSubs.map((s) => s.endpoint));
        } else if (results.every((r) => r.res.gone || r.res.unconfigured)) {
          status = "skipped";
        } else {
          status = "failed";
        }
      }
      tally[status] += 1;
      await db.from("ultima_notifications").update({ push_status: status }).eq("id", row.id);
    }),
  );

  if (deadEndpoints.size) {
    await db.from("ultima_push_subscriptions").delete().in("endpoint", [...deadEndpoints]);
    tally.deleted = deadEndpoints.size;
  }
  return tally;
}

async function withBudget(promise) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), SEND_BUDGET_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Create inbox rows and send the pushes that are due now.
 * item: { managerId, competitionId?, kind, title, body?, link?, push?, category?,
 *         urgent?, expiresAt? }
 * Quiet hours hold a push to 08:00 Dubai. The inbox row is created either way.
 */
export async function createNotifications(items, { now = Date.now() } = {}) {
  const db = getUltimaDb();
  const list = (items ?? []).filter((i) => i?.managerId && i.kind && i.title);
  if (!db || !list.length) return { created: 0, rows: [] };

  const managers = await loadManagers(
    db,
    list.map((i) => i.managerId),
  );

  const prepared = [];
  for (const item of list) {
    const manager = managers.get(item.managerId);
    if (!manager || manager.is_bot) continue;
    const category = item.category ?? categoryForKind(item.kind);
    const plan = planPush(
      { ...item, category, push: item.push ?? !isInboxOnly(item.kind) },
      { prefs: manager.notify_prefs, now },
    );
    prepared.push({
      manager_id: item.managerId,
      competition_id: item.competitionId ?? manager.competition_id,
      kind: item.kind,
      title: item.title,
      body: item.body ?? "",
      link: item.link ?? null,
      push_status: plan.push_status,
      send_after: plan.send_after,
    });
  }
  if (!prepared.length) return { created: 0, rows: [] };

  const { data: inserted, error } = await db
    .from("ultima_notifications")
    .insert(prepared)
    .select("id, manager_id, kind, title, body, link, push_status");
  if (error) {
    console.error("[ultima/notifications] insert failed:", error.message);
    return { created: 0, rows: [] };
  }

  const rows = inserted ?? [];
  const queued = rows.filter((r) => r.push_status === "queued");
  if (queued.length) await withBudget(deliverPushes(db, queued));
  return { created: rows.length, rows };
}

/** Send held pushes whose time has come, and retry pushes stuck in queued. */
export async function releaseDuePushes({ now = Date.now() } = {}) {
  const db = getUltimaDb();
  if (!db) return { released: 0 };
  const nowIso = new Date(now).toISOString();
  const stuckIso = new Date(now - STUCK_QUEUED_MS).toISOString();

  const [{ data: held }, { data: stuck }] = await Promise.all([
    db
      .from("ultima_notifications")
      .select("id, manager_id, kind, title, body, link")
      .eq("push_status", "held")
      .lte("send_after", nowIso)
      .order("created_at", { ascending: true })
      .limit(200),
    db
      .from("ultima_notifications")
      .select("id, manager_id, kind, title, body, link")
      .eq("push_status", "queued")
      .lte("created_at", stuckIso)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);
  const due = [...(held ?? []), ...(stuck ?? [])];
  if (!due.length) return { released: 0 };

  // A manager may have switched a category off while the push was held.
  const managers = await loadManagers(
    db,
    due.map((r) => r.manager_id),
  );
  const send = [];
  const drop = [];
  for (const row of due) {
    const manager = managers.get(row.manager_id);
    if (manager && pushAllowed(manager.notify_prefs, categoryForKind(row.kind))) send.push(row);
    else drop.push(row.id);
  }
  if (drop.length) {
    await db.from("ultima_notifications").update({ push_status: "skipped" }).in("id", drop);
  }
  const tally = await deliverPushes(db, send);
  return { released: send.length, ...tally };
}

/**
 * Once-only guard for scheduled notifications, on the existing dedupe log.
 * True the first time a (manager, kind, ref) is claimed.
 */
export async function claimOnce(managerId, kind, refId) {
  const db = getUltimaDb();
  if (!db || !managerId) return false;
  const { error } = await db
    .from("ultima_notification_log")
    .insert({ manager_id: managerId, kind, ref_id: String(refId) });
  if (!error) return true;
  if (error.code !== "23505") {
    console.error("[ultima/notifications] dedupe log failed:", error.message);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

export async function listInbox(managerId, limit = 60) {
  const db = getReadDb();
  if (!db || !managerId) return [];
  const { data } = await db
    .from("ultima_notifications")
    .select("id, kind, title, body, link, created_at, read_at")
    .eq("manager_id", managerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function unreadCount(managerId) {
  const db = getReadDb();
  if (!db || !managerId) return 0;
  const { count } = await db
    .from("ultima_notifications")
    .select("id", { count: "exact", head: true })
    .eq("manager_id", managerId)
    .is("read_at", null);
  return count ?? 0;
}

/** Mark one notification, or all of them, read. Always scoped to the manager. */
export async function markRead({ managerId, id = null, all = false }) {
  const db = getUltimaDb();
  if (!db || !managerId || (!id && !all)) return { ok: false };
  let query = db
    .from("ultima_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("manager_id", managerId)
    .is("read_at", null);
  if (!all) query = query.eq("id", id);
  const { error } = await query;
  return { ok: !error };
}

// ---------------------------------------------------------------------------
// Push subscriptions
// ---------------------------------------------------------------------------

function validSubscription(sub) {
  return (
    sub &&
    typeof sub.endpoint === "string" &&
    /^https:\/\//.test(sub.endpoint) &&
    sub.endpoint.length <= 2048 &&
    typeof sub.keys?.p256dh === "string" &&
    typeof sub.keys?.auth === "string"
  );
}

export async function saveSubscription({ managerId, subscription, userAgent }) {
  const db = getUltimaDb();
  if (!db || !managerId) return { ok: false, code: "UNAVAILABLE" };
  if (!validSubscription(subscription)) return { ok: false, code: "INVALID" };
  const { error } = await db.from("ultima_push_subscriptions").upsert(
    {
      manager_id: managerId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: typeof userAgent === "string" ? userAgent.slice(0, 300) : null,
    },
    { onConflict: "endpoint" },
  );
  return error ? { ok: false, code: "UNAVAILABLE" } : { ok: true };
}

export async function removeSubscription({ managerId, endpoint }) {
  const db = getUltimaDb();
  if (!db || !managerId || typeof endpoint !== "string") return { ok: false };
  const { error } = await db
    .from("ultima_push_subscriptions")
    .delete()
    .eq("manager_id", managerId)
    .eq("endpoint", endpoint);
  return { ok: !error };
}

export async function countSubscriptions(managerId) {
  const db = getUltimaDb();
  if (!db || !managerId) return 0;
  const { count } = await db
    .from("ultima_push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("manager_id", managerId);
  return count ?? 0;
}

/** A direct push to this manager's devices. Skips prefs and quiet hours, writes no inbox row. */
export async function sendTestPush(managerId) {
  const db = getUltimaDb();
  if (!db || !managerId) return { ok: false, code: "UNAVAILABLE" };
  const { data: subs } = await db
    .from("ultima_push_subscriptions")
    .select("id, manager_id, endpoint, p256dh, auth")
    .eq("manager_id", managerId);
  if (!subs?.length) return { ok: false, code: "NO_SUBSCRIPTION" };

  const payload = pushPayload({
    id: null,
    kind: "test",
    title: "Ultima",
    body: "Notifications are on.",
    link: "/ultima/inbox",
  });
  const results = await Promise.all(subs.map(async (sub) => ({ sub, res: await sendWebPush(sub, payload) })));
  const dead = results.filter((r) => r.res.gone).map((r) => r.sub.endpoint);
  if (dead.length) await db.from("ultima_push_subscriptions").delete().in("endpoint", dead);
  const ok = results.filter((r) => r.res.ok);
  if (ok.length) {
    await db
      .from("ultima_push_subscriptions")
      .update({ last_ok_at: new Date().toISOString() })
      .in("endpoint", ok.map((r) => r.sub.endpoint));
    return { ok: true, sent: ok.length };
  }
  return { ok: false, code: dead.length === results.length ? "NO_SUBSCRIPTION" : "SEND_FAILED" };
}

// ---------------------------------------------------------------------------
// Event hooks. Each one is called from the server code that writes the matching
// ultima_events row, and never throws into the caller.
// ---------------------------------------------------------------------------

function tradeLink(tradeId) {
  return `/ultima/trades/${tradeId}`;
}

function nameList(names) {
  const items = (names ?? []).filter(Boolean);
  if (!items.length) return "players";
  if (items.length <= 2) return items.join(" and ");
  return `${items[0]}, ${items[1]} and ${items.length - 2} more`;
}

/** "Saka for Rice": what the proposer gives for what the receiver gives. */
async function dealLine(db, tradeId, proposerId, receiverId) {
  const { data } = await db
    .from("ultima_trade_players")
    .select("from_manager_id, ultima_players(name)")
    .eq("trade_id", tradeId);
  const namesFrom = (id) =>
    (data ?? []).filter((r) => r.from_manager_id === id).map((r) => r.ultima_players?.name);
  return `${nameList(namesFrom(proposerId))} for ${nameList(namesFrom(receiverId))}`;
}

/** Offer received, or countered. To the receiver. */
export const notifyOfferReceived = safely(
  "offer received",
  async ({ tradeId, proposerId, receiverId, counter = false }) => {
    const db = getUltimaDb();
    if (!db) return;
    const managers = await loadManagers(db, [proposerId, receiverId]);
    const from = managers.get(proposerId)?.team_name ?? "A manager";
    const deal = await dealLine(db, tradeId, proposerId, receiverId);
    await createNotifications([
      {
        managerId: receiverId,
        kind: counter ? "offer_countered" : "offer_received",
        title: counter ? "Counter offer" : "Offer received",
        body: `${from} offered ${deal}.`,
        link: tradeLink(tradeId),
      },
    ]);
  },
);

const ANSWER_COPY = {
  accepted: { kind: "offer_accepted", title: "Offer accepted", verb: "accepted" },
  declined: { kind: "offer_declined", title: "Offer declined", verb: "declined" },
  withdrawn: { kind: "offer_withdrawn", title: "Offer withdrawn", verb: "withdrew" },
  expired: { kind: "offer_expired", title: "Offer expired", verb: "expired" },
  voided: { kind: "offer_voided", title: "Offer voided", verb: "voided" },
};

/** Accepted, declined, withdrawn, expired or voided. To both managers. */
export const notifyOfferAnswered = safely(
  "offer answered",
  async ({ tradeId, state, proposerId, receiverId, reason = null }) => {
    const db = getUltimaDb();
    const copy = ANSWER_COPY[state];
    if (!db || !copy) return;
    const managers = await loadManagers(db, [proposerId, receiverId]);
    const proposer = managers.get(proposerId)?.team_name ?? "A manager";
    const receiver = managers.get(receiverId)?.team_name ?? "A manager";
    const deal = await dealLine(db, tradeId, proposerId, receiverId);
    let body;
    switch (state) {
      case "accepted":
        body = `${receiver} accepted ${deal}. League review is open.`;
        break;
      case "declined":
        body = `${receiver} declined ${deal}.`;
        break;
      case "withdrawn":
        body = `${proposer} withdrew ${deal}.`;
        break;
      case "expired":
        body = `${deal} between ${proposer} and ${receiver} expired.`;
        break;
      default: {
        const why = VOID_REASON_LINE[reason];
        body = `${deal} between ${proposer} and ${receiver} was voided.${why ? ` ${why}` : ""}`;
      }
    }
    await createNotifications(
      [proposerId, receiverId].map((managerId) => ({
        managerId,
        kind: copy.kind,
        title: copy.title,
        body,
        link: tradeLink(tradeId),
      })),
    );
  },
);

/** Voided offers from a database call. Rows are { trade_id, proposer_id, receiver_id } or bare trade ids. */
export const notifyVoidedTrades = safely("voided trades", async (voided, reason = null) => {
  const db = getUltimaDb();
  if (!db || !voided?.length) return;
  for (const entry of voided) {
    let row = typeof entry === "string" ? { trade_id: entry } : entry;
    if (!row?.trade_id) continue;
    if (!row.proposer_id || !row.receiver_id) {
      const { data } = await db
        .from("ultima_trades")
        .select("id, proposer_id, receiver_id")
        .eq("id", row.trade_id)
        .maybeSingle();
      if (!data) continue;
      row = { ...row, proposer_id: data.proposer_id, receiver_id: data.receiver_id };
    }
    await notifyOfferAnswered({
      tradeId: row.trade_id,
      state: "voided",
      proposerId: row.proposer_id,
      receiverId: row.receiver_id,
      reason,
    });
  }
});

/** Offers that expired in the database call. */
export const notifyExpiredTrades = safely("expired trades", async (expired) => {
  for (const row of expired ?? []) {
    if (!row?.trade_id || !row.proposer_id || !row.receiver_id) continue;
    await notifyOfferAnswered({
      tradeId: row.trade_id,
      state: "expired",
      proposerId: row.proposer_id,
      receiverId: row.receiver_id,
    });
  }
});

/**
 * A trade went to league review. The two managers hear it was accepted. The
 * other human managers hear the veto is open.
 */
export const notifyTradeInReview = safely(
  "trade in review",
  async ({ tradeId, proposerId, receiverId, competitionId }) => {
    const db = getUltimaDb();
    if (!db) return;
    await notifyOfferAnswered({ tradeId, state: "accepted", proposerId, receiverId });

    const [managers, humans] = await Promise.all([
      loadManagers(db, [proposerId, receiverId]),
      humanManagersOf(db, competitionId),
    ]);
    const proposer = managers.get(proposerId)?.team_name ?? "A manager";
    const receiver = managers.get(receiverId)?.team_name ?? "A manager";
    const others = humans.filter((m) => m.id !== proposerId && m.id !== receiverId);
    await createNotifications(
      others.map((m) => ({
        managerId: m.id,
        competitionId,
        kind: "trade_review",
        title: "Trade in review",
        body: `${proposer} and ${receiver} agreed a deal. Veto is open.`,
        link: tradeLink(tradeId),
      })),
    );
  },
);

/** Executed or vetoed. Inbox only, to every human manager. */
export const notifyTradeSettled = safely(
  "trade settled",
  async ({ tradeId, state, proposerId, receiverId, competitionId }) => {
    const db = getUltimaDb();
    if (!db || !["executed", "vetoed"].includes(state)) return;
    const [managers, humans, deal] = await Promise.all([
      loadManagers(db, [proposerId, receiverId]),
      humanManagersOf(db, competitionId),
      dealLine(db, tradeId, proposerId, receiverId),
    ]);
    const proposer = managers.get(proposerId)?.team_name ?? "A manager";
    const receiver = managers.get(receiverId)?.team_name ?? "A manager";
    const executed = state === "executed";
    await createNotifications(
      humans.map((m) => ({
        managerId: m.id,
        competitionId,
        kind: executed ? "trade_executed" : "trade_vetoed",
        title: executed ? "Trade done" : "Trade vetoed",
        body: executed
          ? `${proposer} and ${receiver} traded ${deal}.`
          : `The league vetoed ${deal} between ${proposer} and ${receiver}.`,
        link: tradeLink(tradeId),
        push: false,
      })),
    );
  },
);

/** A signing, with or without a release. Inbox only, to every human manager. */
export const notifyMarketMove = safely(
  "market move",
  async ({ managerId, added = null, dropped = null }) => {
    const db = getUltimaDb();
    if (!db || !managerId || (!added && !dropped)) return;
    const managers = await loadManagers(db, [managerId]);
    const team = managers.get(managerId)?.team_name ?? "A manager";
    const competitionId = managers.get(managerId)?.competition_id;
    const humans = await humanManagersOf(db, competitionId);
    const signing = Boolean(added);
    const body = signing
      ? `${team} signed ${added.name}${dropped ? ` and released ${dropped.name}` : ""}.`
      : `${team} released ${dropped.name}.`;
    await createNotifications(
      humans.map((m) => ({
        managerId: m.id,
        competitionId,
        kind: signing ? "market_signing" : "market_release",
        title: signing ? "Signing" : "Release",
        body,
        link: "/ultima/market",
        push: false,
      })),
    );
  },
);

/** A player on managers' shortlists was transfer listed. To each watcher. */
export const notifyShortlistListed = safely(
  "shortlist listed",
  async ({ ownerId, playerId, competitionId }) => {
    const db = getUltimaDb();
    if (!db || !ownerId || !playerId) return;
    const [{ data: watchers }, { data: player }, managers] = await Promise.all([
      db.from("ultima_watchlist").select("manager_id").eq("player_id", playerId),
      db.from("ultima_players").select("id, name").eq("id", playerId).maybeSingle(),
      loadManagers(db, [ownerId]),
    ]);
    const ids = (watchers ?? []).map((w) => w.manager_id).filter((id) => id && id !== ownerId);
    if (!ids.length || !player?.name) return;
    const team = managers.get(ownerId)?.team_name;
    await createNotifications(
      ids.map((managerId) => ({
        managerId,
        competitionId,
        kind: "shortlist_listed",
        title: "Shortlist",
        body: `${player.name} is transfer listed${team ? ` by ${team}` : ""}.`,
        link: "/ultima/trades?tab=block",
      })),
    );
  },
);

/**
 * A player the manager owns moved league, left the five leagues, or lost an XV
 * slot. kind: "moved" | "left". `slotEmptied` adds the XV line.
 */
export const notifySquadMove = safely(
  "squad move",
  async ({ managerId, playerName, kind, toLeague = null, slotEmptied = false }) => {
    if (!managerId || !playerName) return;
    const tail = slotEmptied ? " His XV slot is empty." : "";
    let notification;
    if (kind === "left") {
      notification = {
        kind: "player_left",
        title: "Player left the five leagues",
        body: `${playerName} left the five leagues.${tail}`,
      };
    } else if (kind === "moved") {
      const where = ULTIMA_LEAGUE_LABELS[toLeague] ?? "another league";
      notification = {
        kind: slotEmptied ? "xv_slot_emptied" : "player_moved",
        title: slotEmptied ? "XV slot empty" : "Player moved league",
        body: `${playerName} moved to ${where}.${tail}`,
      };
    } else {
      return;
    }
    await createNotifications([{ managerId, ...notification, link: "/ultima/squad" }]);
  },
);
