import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { has, makeFakeDb } from "./helpers/fake-db.mjs";
import {
  alwaysPush,
  inQuietHours,
  lockReminderDue,
  needsLockReminder,
  offerExpiringDue,
  planPush,
  pushAllowed,
  quietHoursEnd,
  safeLink,
} from "../../lib/ultima/notifications/rules.js";
import { normalizeNotifyPrefs } from "../../lib/ultima/constants.js";

// 06 Oct 2026, hour:minute in Asia/Dubai (UTC+4).
const gst = (hour, minute = 0) => Date.UTC(2026, 9, 6, hour - 4, minute);

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

test("quiet hours: 01:00 to 08:00 Dubai, edges included correctly", () => {
  assert.equal(inQuietHours(gst(0, 59)), false);
  assert.equal(inQuietHours(gst(1, 0)), true);
  assert.equal(inQuietHours(gst(7, 59)), true);
  assert.equal(inQuietHours(gst(8, 0)), false);
  assert.equal(inQuietHours(gst(23, 30)), false);
});

test("quiet hours: a held push is sent at 08:00 Dubai the same morning", () => {
  assert.equal(quietHoursEnd(gst(2, 30)), new Date(gst(8, 0)).toISOString());
  assert.equal(quietHoursEnd(gst(7, 59)), new Date(gst(8, 0)).toISOString());
  // Inside the window that crosses UTC midnight (01:00 GST is 21:00 UTC the day before).
  assert.equal(quietHoursEnd(Date.UTC(2026, 9, 5, 21, 0)), new Date(gst(8, 0)).toISOString());
});

test("plan: an ordinary push in quiet hours is held until 08:00, in the day it queues", () => {
  const item = { kind: "offer_received", category: "offers", push: true };
  assert.deepEqual(planPush(item, { now: gst(3) }), {
    push_status: "held",
    send_after: new Date(gst(8)).toISOString(),
  });
  assert.deepEqual(planPush(item, { now: gst(12) }), { push_status: "queued", send_after: null });
});

test("plan: the three exceptions always push, even at 03:00", () => {
  const now = gst(3);
  for (const kind of ["offer_expiring", "lock_reminder", "broadcast"]) {
    assert.equal(planPush({ kind, category: "offers", push: true }, { now }).push_status, "queued", kind);
  }
  // An offer inside its last 6 hours pushes too, whatever its kind.
  const soon = new Date(now + 5 * 3_600_000).toISOString();
  const later = new Date(now + 7 * 3_600_000).toISOString();
  assert.equal(alwaysPush({ kind: "offer_received", expiresAt: soon }, now), true);
  assert.equal(alwaysPush({ kind: "offer_received", expiresAt: later }, now), false);
  assert.equal(alwaysPush({ kind: "offer_received", expiresAt: new Date(now - 1000).toISOString() }, now), false);
});

test("plan: inbox only and switched-off categories never push", () => {
  assert.equal(planPush({ kind: "trade_executed", category: "league", push: false }, { now: gst(12) }).push_status, "skipped");
  const prefs = { push_offers: false };
  assert.equal(pushAllowed(prefs, "offers"), false);
  assert.equal(pushAllowed(prefs, "locks"), true);
  assert.equal(pushAllowed(null, "locks"), true);
  assert.equal(
    planPush({ kind: "offer_received", category: "offers", push: true }, { prefs, now: gst(12) }).push_status,
    "skipped",
  );
});

test("prefs: profile save keeps the push toggles", () => {
  const prefs = normalizeNotifyPrefs({ push_locks: false });
  assert.equal(prefs.push_locks, false);
  assert.equal(prefs.push_offers, true);
  assert.equal(prefs.trade_proposed, true);
});

test("lock reminder window: inside the last 3 hours before the open time", () => {
  const now = gst(12);
  assert.equal(lockReminderDue(new Date(now + 2.9 * 3_600_000).toISOString(), now), true);
  assert.equal(lockReminderDue(new Date(now + 3.1 * 3_600_000).toISOString(), now), false);
  assert.equal(lockReminderDue(new Date(now - 1000).toISOString(), now), false);
});

test("lock reminder need: an empty slot or no captain, never a full XV with a captain", () => {
  const full = ["a", "b", "c"].map((id, i) => ({ slot: i + 1, slot_group: "pl", player_id: id }));
  assert.equal(needsLockReminder(full, "a", "pl"), false);
  assert.equal(needsLockReminder(full, null, "pl"), true);
  assert.equal(needsLockReminder([...full.slice(0, 2), { slot: 3, slot_group: "pl", player_id: null }], "a", "pl"), true);
});

test("offer expiring window: the last 6 hours of 48", () => {
  const now = gst(12);
  const sentAgo = (h) => new Date(now - h * 3_600_000).toISOString();
  assert.equal(offerExpiringDue(sentAgo(43), now), true);
  assert.equal(offerExpiringDue(sentAgo(41), now), false);
  assert.equal(offerExpiringDue(sentAgo(49), now), false);
});

test("links: only app paths", () => {
  assert.equal(safeLink("/ultima/trades/1"), "/ultima/trades/1");
  assert.equal(safeLink("https://evil.example"), "/ultima");
  assert.equal(safeLink("//evil.example"), "/ultima");
  assert.equal(safeLink(null), "/ultima");
});

// ---------------------------------------------------------------------------
// Server code on a fake database
// ---------------------------------------------------------------------------

const COMP = "comp-1";
const world = {};

function reset() {
  Object.assign(world, {
    managers: [
      { id: "m1", competition_id: COMP, team_name: "Alpha", is_bot: false, notify_prefs: {} },
      { id: "m2", competition_id: COMP, team_name: "Bravo", is_bot: false, notify_prefs: {} },
      { id: "m3", competition_id: COMP, team_name: "Charlie", is_bot: false, notify_prefs: {} },
      { id: "b1", competition_id: COMP, team_name: "Botty", is_bot: true, notify_prefs: {} },
    ],
    subs: [],
    notifications: [],
    updates: [],
    deletedEndpoints: [],
    logKeys: new Set(),
    broadcasts: [],
    gameweeks: [],
    pushCalls: [],
    pushResult: () => ({ ok: true }),
    emails: [],
    lineups: {},
    seq: 0,
  });
}
reset();

function handler(q) {
  switch (q.table) {
    case "ultima_managers": {
      let rows = world.managers;
      const inFilter = q.filters.find((f) => f[0] === "in" && f[1] === "id");
      if (inFilter) rows = rows.filter((m) => inFilter[2].includes(m.id));
      if (has(q, "eq", "is_bot", false)) rows = rows.filter((m) => !m.is_bot);
      return { data: rows, error: null };
    }
    case "ultima_notifications": {
      if (q.op === "insert") {
        const rows = q.payload.map((p) => ({ id: `n${++world.seq}`, created_at: "2026-10-06T00:00:00Z", read_at: null, ...p }));
        world.notifications.push(...rows);
        return { data: rows, error: null };
      }
      if (q.op === "update") {
        const id = q.filters.find((f) => f[0] === "eq" && f[1] === "id")?.[2];
        const ids = q.filters.find((f) => f[0] === "in" && f[1] === "id")?.[2];
        world.updates.push({ id, ids, payload: q.payload });
        for (const n of world.notifications) {
          if (n.id === id || ids?.includes(n.id)) Object.assign(n, q.payload);
        }
        return { data: null, error: null };
      }
      if (has(q, "eq", "push_status", "held")) {
        return { data: world.notifications.filter((n) => n.push_status === "held"), error: null };
      }
      if (has(q, "eq", "push_status", "queued")) {
        return { data: world.notifications.filter((n) => n.push_status === "queued" && n.stuck), error: null };
      }
      return { data: [], error: null };
    }
    case "ultima_push_subscriptions": {
      if (q.op === "delete") {
        world.deletedEndpoints.push(...q.filters.find((f) => f[0] === "in")[2]);
        return { data: null, error: null };
      }
      if (q.op === "update") return { data: null, error: null };
      const ids = q.filters.find((f) => f[0] === "in" && f[1] === "manager_id")?.[2];
      return { data: world.subs.filter((s) => !ids || ids.includes(s.manager_id)), error: null };
    }
    case "ultima_notification_log": {
      const key = `${q.payload.manager_id}|${q.payload.kind}|${q.payload.ref_id}`;
      if (world.logKeys.has(key)) return { data: null, error: { code: "23505", message: "duplicate" } };
      world.logKeys.add(key);
      return { data: null, error: null };
    }
    case "ultima_broadcasts":
      if (q.op === "insert") {
        world.broadcasts.push(q.payload);
        return { data: { id: "bc1" }, error: null };
      }
      return { data: [], error: null };
    case "ultima_gameweeks":
      return { data: world.gameweeks, error: null };
    case "ultima_admin_log":
      return { data: null, error: null };
    default:
      return { data: [], error: null };
  }
}

const fake = makeFakeDb(handler);
mock.module("@/lib/ultima/server/db", {
  namedExports: {
    getUltimaDb: () => fake,
    getActiveCompetition: async () => ({ id: COMP }),
  },
});
mock.module("@/lib/ultima/server/push", {
  namedExports: {
    sendWebPush: async (sub, payload) => {
      world.pushCalls.push({ sub, payload });
      return world.pushResult(sub);
    },
    pushConfigured: () => true,
    vapidPublicKey: () => "pub",
  },
});
mock.module("@/lib/ultima/server/lineup", {
  namedExports: {
    getLineup: async (managerId) => world.lineups[managerId] ?? [],
    getPrevCaptains: async () => ({}),
  },
});
mock.module("@/lib/ultima/server/trades", {
  namedExports: { expireStaleTrades: async () => ({ expired: [] }) },
});
mock.module("@/lib/ultima/server/managers", {
  namedExports: {
    getManagerEmailsForCompetition: async () =>
      world.managers.filter((m) => !m.is_bot).map((m) => ({ managerId: m.id, email: `${m.id}@example.test` })),
  },
});
mock.module("@/lib/ultima/server/notify", {
  namedExports: {
    sendUltimaEmail: async (mail) => {
      world.emails.push(mail);
      return { ok: true };
    },
  },
});

const notifications = await import("../../lib/ultima/server/notifications.js");
const cron = await import("../../lib/ultima/server/notify-cron.js");
const { sendBroadcast, cleanBroadcast } = await import("../../lib/ultima/server/broadcast.js");

const sub = (managerId, n = 1) => ({
  id: `s-${managerId}-${n}`,
  manager_id: managerId,
  endpoint: `https://push.example/${managerId}/${n}`,
  p256dh: "p",
  auth: "a",
});

test("quiet hours hold: the inbox row is created at 03:00, the push waits, nothing is sent", async () => {
  reset();
  world.subs.push(sub("m2"));
  const { created } = await notifications.createNotifications(
    [{ managerId: "m2", kind: "offer_received", title: "Offer received", body: "Alpha offered X for Y." }],
    { now: gst(3) },
  );
  assert.equal(created, 1);
  assert.equal(world.notifications.length, 1);
  assert.equal(world.notifications[0].push_status, "held");
  assert.equal(world.notifications[0].send_after, new Date(gst(8)).toISOString());
  assert.equal(world.pushCalls.length, 0);
});

test("quiet hours release: the held push goes out once 08:00 has passed, and is marked sent", async () => {
  reset();
  world.subs.push(sub("m2"));
  await notifications.createNotifications(
    [{ managerId: "m2", kind: "offer_received", title: "Offer received", body: "x", link: "/ultima/trades/t1" }],
    { now: gst(3) },
  );
  assert.equal(world.pushCalls.length, 0);

  const out = await notifications.releaseDuePushes({ now: gst(8, 5) });
  assert.equal(out.released, 1);
  assert.equal(world.pushCalls.length, 1);
  assert.equal(world.pushCalls[0].payload.link, "/ultima/trades/t1");
  assert.equal(world.notifications[0].push_status, "sent");
});

test("release: a category switched off while the push was held is skipped, not sent", async () => {
  reset();
  world.subs.push(sub("m2"));
  await notifications.createNotifications(
    [{ managerId: "m2", kind: "offer_received", title: "Offer received", body: "x" }],
    { now: gst(3) },
  );
  world.managers.find((m) => m.id === "m2").notify_prefs = { push_offers: false };
  await notifications.releaseDuePushes({ now: gst(8, 5) });
  assert.equal(world.pushCalls.length, 0);
  assert.equal(world.notifications[0].push_status, "skipped");
});

test("exceptions push at 03:00: offer expiring, lock reminder, broadcast", async () => {
  reset();
  world.subs.push(sub("m2"));
  for (const kind of ["offer_expiring", "lock_reminder", "broadcast"]) {
    await notifications.createNotifications([{ managerId: "m2", kind, title: kind, body: "x" }], { now: gst(3) });
  }
  assert.equal(world.pushCalls.length, 3);
  assert.deepEqual(
    world.notifications.map((n) => n.push_status),
    ["sent", "sent", "sent"],
  );
});

test("an offer inside its last 6 hours pushes through quiet hours", async () => {
  reset();
  world.subs.push(sub("m2"));
  await notifications.createNotifications(
    [{ managerId: "m2", kind: "offer_received", title: "Offer", body: "x", expiresAt: new Date(gst(3) + 4 * 3_600_000).toISOString() }],
    { now: gst(3) },
  );
  assert.equal(world.pushCalls.length, 1);
});

test("a dead subscription (410) is deleted, a live one on the same manager still sends", async () => {
  reset();
  world.subs.push(sub("m2", 1), sub("m2", 2));
  world.pushResult = (s) => (s.endpoint.endsWith("/1") ? { ok: false, statusCode: 410, gone: true } : { ok: true });
  await notifications.createNotifications(
    [{ managerId: "m2", kind: "offer_received", title: "Offer", body: "x" }],
    { now: gst(12) },
  );
  assert.deepEqual(world.deletedEndpoints, ["https://push.example/m2/1"]);
  assert.equal(world.notifications[0].push_status, "sent");
});

test("when every subscription is dead (404) all are deleted and the push is skipped", async () => {
  reset();
  world.subs.push(sub("m2"));
  world.pushResult = () => ({ ok: false, statusCode: 404, gone: true });
  await notifications.createNotifications(
    [{ managerId: "m2", kind: "offer_received", title: "Offer", body: "x" }],
    { now: gst(12) },
  );
  assert.deepEqual(world.deletedEndpoints, ["https://push.example/m2/1"]);
  assert.equal(world.notifications[0].push_status, "skipped");
});

test("a transient push failure keeps the subscription and marks the push failed", async () => {
  reset();
  world.subs.push(sub("m2"));
  world.pushResult = () => ({ ok: false, statusCode: 503, gone: false });
  await notifications.createNotifications(
    [{ managerId: "m2", kind: "offer_received", title: "Offer", body: "x" }],
    { now: gst(12) },
  );
  assert.deepEqual(world.deletedEndpoints, []);
  assert.equal(world.notifications[0].push_status, "failed");
});

test("bots get nothing, and a manager with no subscription gets an inbox row only", async () => {
  reset();
  const { created } = await notifications.createNotifications(
    [
      { managerId: "b1", kind: "offer_received", title: "Offer", body: "x" },
      { managerId: "m3", kind: "offer_received", title: "Offer", body: "x" },
    ],
    { now: gst(12) },
  );
  assert.equal(created, 1);
  assert.equal(world.notifications[0].manager_id, "m3");
  assert.equal(world.notifications[0].push_status, "skipped");
  assert.equal(world.pushCalls.length, 0);
});

// ---------------------------------------------------------------------------
// Who gets what
// ---------------------------------------------------------------------------

test("offer received: only the receiver, with push", async () => {
  reset();
  world.subs.push(sub("m1"), sub("m2"));
  await notifications.notifyOfferReceived({ tradeId: "t1", proposerId: "m1", receiverId: "m2" });
  assert.deepEqual(world.notifications.map((n) => [n.manager_id, n.kind]), [["m2", "offer_received"]]);
  assert.equal(world.pushCalls.length, 1);
});

test("counter offer: the receiver gets the counter kind", async () => {
  reset();
  await notifications.notifyOfferReceived({ tradeId: "t2", proposerId: "m2", receiverId: "m1", counter: true });
  assert.deepEqual(world.notifications.map((n) => [n.manager_id, n.kind]), [["m1", "offer_countered"]]);
});

test("accepted, declined, withdrawn, expired, voided: both managers, push and inbox", async () => {
  for (const [state, kind] of [
    ["accepted", "offer_accepted"],
    ["declined", "offer_declined"],
    ["withdrawn", "offer_withdrawn"],
    ["expired", "offer_expired"],
    ["voided", "offer_voided"],
  ]) {
    reset();
    world.subs.push(sub("m1"), sub("m2"));
    await notifications.notifyOfferAnswered({ tradeId: "t3", state, proposerId: "m1", receiverId: "m2" });
    assert.deepEqual(world.notifications.map((n) => n.manager_id).sort(), ["m1", "m2"], state);
    assert.ok(world.notifications.every((n) => n.kind === kind), state);
    assert.equal(world.pushCalls.length, 2, state);
  }
});

test("trade in review: the two managers hear accepted, the other humans hear veto is open, bots hear nothing", async () => {
  reset();
  world.subs.push(sub("m1"), sub("m2"), sub("m3"));
  await notifications.notifyTradeInReview({
    tradeId: "t4",
    proposerId: "m1",
    receiverId: "m2",
    competitionId: COMP,
  });
  const byManager = Object.fromEntries(world.notifications.map((n) => [n.manager_id, n.kind]));
  assert.deepEqual(byManager, { m1: "offer_accepted", m2: "offer_accepted", m3: "trade_review" });
  assert.ok(!("b1" in byManager));
  assert.equal(world.pushCalls.length, 3);
});

test("trade executed or vetoed: inbox only, to every human manager", async () => {
  for (const state of ["executed", "vetoed"]) {
    reset();
    world.subs.push(sub("m1"), sub("m2"), sub("m3"));
    await notifications.notifyTradeSettled({
      tradeId: "t5",
      state,
      proposerId: "m1",
      receiverId: "m2",
      competitionId: COMP,
    });
    assert.deepEqual(world.notifications.map((n) => n.manager_id).sort(), ["m1", "m2", "m3"], state);
    assert.ok(world.notifications.every((n) => n.push_status === "skipped"), state);
    assert.equal(world.pushCalls.length, 0, state);
  }
});

test("signings and releases: inbox only, to every human manager", async () => {
  reset();
  world.subs.push(sub("m1"), sub("m2"), sub("m3"));
  await notifications.notifyMarketMove({
    managerId: "m1",
    added: { name: "Saka" },
    dropped: { name: "Rice" },
  });
  assert.equal(world.notifications.length, 3);
  assert.ok(world.notifications.every((n) => n.kind === "market_signing" && n.push_status === "skipped"));
  assert.match(world.notifications[0].body, /Alpha signed Saka and released Rice/);
  assert.equal(world.pushCalls.length, 0);
});

test("squad move: the owner gets the push, with the empty XV slot line", async () => {
  reset();
  world.subs.push(sub("m1"));
  await notifications.notifySquadMove({
    managerId: "m1",
    playerName: "Gordon",
    kind: "moved",
    toLeague: "laliga",
    slotEmptied: true,
  });
  assert.equal(world.notifications[0].kind, "xv_slot_emptied");
  assert.match(world.notifications[0].body, /moved to LaLiga\. His XV slot is empty\./);
  assert.equal(world.pushCalls.length, 1);

  reset();
  await notifications.notifySquadMove({ managerId: "m1", playerName: "Gordon", kind: "left" });
  assert.equal(world.notifications[0].kind, "player_left");
});

// ---------------------------------------------------------------------------
// Scheduled sends
// ---------------------------------------------------------------------------

function lineup(league, { empty = false, captain = true } = {}) {
  const rows = ["pl", "laliga", "seriea", "bundesliga", "ligue1"].flatMap((lg, li) =>
    [1, 2, 3].map((n) => ({
      slot: li * 3 + n,
      slot_group: lg,
      player_id: empty && lg === league && n === 3 ? null : `${lg}-${n}`,
      is_captain: captain && n === 1,
    })),
  );
  return rows;
}

function plOpensIn(now, hours) {
  world.gameweeks = [
    {
      id: "gw1",
      number: 4,
      competition_id: COMP,
      state: "upcoming",
      league_open_at: {
        pl: new Date(now + hours * 3_600_000).toISOString(),
        laliga: new Date(now + 48 * 3_600_000).toISOString(),
      },
    },
  ];
}

test("lock reminder: fires for an empty slot and for no captain, never for a full XV with a captain", async () => {
  reset();
  const now = gst(12);
  plOpensIn(now, 2.5);
  world.subs.push(sub("m1"), sub("m2"), sub("m3"));
  world.lineups = {
    m1: lineup("pl", { empty: true }),
    m2: lineup("pl"),
    m3: lineup("pl", { captain: false }),
  };
  const out = await cron.runLockReminders(COMP, now);
  assert.equal(out.reminded, 2);
  const byManager = Object.fromEntries(world.notifications.map((n) => [n.manager_id, n]));
  assert.ok(byManager.m1 && byManager.m3);
  assert.ok(!byManager.m2, "a full XV with a captain gets no reminder");
  assert.match(byManager.m1.body, /Empty XV slot\./);
  assert.match(byManager.m3.body, /No captain\./);
  assert.equal(byManager.m1.kind, "lock_reminder");
});

test("lock reminder: once per manager, country and gameweek across cron runs", async () => {
  reset();
  const now = gst(12);
  plOpensIn(now, 2.5);
  world.lineups = { m1: lineup("pl", { empty: true }), m2: lineup("pl"), m3: lineup("pl") };
  const first = await cron.runLockReminders(COMP, now);
  const second = await cron.runLockReminders(COMP, now + 15 * 60_000);
  assert.equal(first.reminded, 1);
  assert.equal(second.reminded, 0);
  assert.equal(world.notifications.length, 1);
});

test("lock reminder: not yet due more than 3 hours out, and still pushes at 03:00 when due", async () => {
  reset();
  plOpensIn(gst(12), 5);
  world.lineups = { m1: lineup("pl", { empty: true }), m2: lineup("pl"), m3: lineup("pl") };
  assert.equal((await cron.runLockReminders(COMP, gst(12))).reminded, 0);

  reset();
  const night = gst(3);
  plOpensIn(night, 2);
  world.subs.push(sub("m1"));
  world.lineups = { m1: lineup("pl", { empty: true }), m2: lineup("pl"), m3: lineup("pl") };
  await cron.runLockReminders(COMP, night);
  assert.equal(world.notifications[0].push_status, "sent");
});

test("offer expiring reminder: the receiver, once, and it pushes at night", async () => {
  reset();
  const now = gst(3);
  world.subs.push(sub("m2"));
  const sent = new Date(now - 43 * 3_600_000).toISOString();
  const db = fake;
  const original = db.from.bind(db);
  db.from = (table) => {
    if (table === "ultima_trades") {
      const api = {};
      for (const m of ["select", "eq", "gte", "lte"]) api[m] = () => api;
      api.then = (resolve) =>
        resolve({ data: [{ id: "t9", proposer_id: "m1", receiver_id: "m2", created_at: sent, competition_id: COMP }], error: null });
      return api;
    }
    return original(table);
  };
  try {
    assert.equal((await cron.runOfferExpiringReminders(COMP, now)).reminded, 1);
    assert.equal((await cron.runOfferExpiringReminders(COMP, now + 900_000)).reminded, 0);
  } finally {
    db.from = original;
  }
  assert.equal(world.notifications[0].kind, "offer_expiring");
  assert.equal(world.notifications[0].manager_id, "m2");
  assert.equal(world.notifications[0].push_status, "sent");
});

// ---------------------------------------------------------------------------
// Broadcast
// ---------------------------------------------------------------------------

test("broadcast: every human manager gets an inbox item and a push, even at 03:00, plus email and the pinned row", async () => {
  reset();
  world.subs.push(sub("m1"), sub("m2"), sub("m3"));
  const real = Date.now;
  Date.now = () => gst(3);
  try {
    const out = await sendBroadcast({
      competitionId: COMP,
      userId: "u1",
      title: "Deadline moved",
      body: "Trades close Friday.",
      pinned: true,
    });
    assert.equal(out.ok, true);
    assert.equal(out.managers, 3);
    assert.equal(out.emailed, 3);
  } finally {
    Date.now = real;
  }
  assert.deepEqual(world.notifications.map((n) => n.manager_id).sort(), ["m1", "m2", "m3"]);
  assert.ok(world.notifications.every((n) => n.kind === "broadcast" && n.push_status === "sent"));
  assert.equal(world.pushCalls.length, 3);
  assert.equal(world.broadcasts[0].pinned, true);
  assert.equal(world.emails.length, 3);
});

test("broadcast: 60 character title, 280 character message, both required", async () => {
  assert.equal(cleanBroadcast({ title: "x".repeat(60), body: "y".repeat(280) }).ok, true);
  assert.equal(cleanBroadcast({ title: "x".repeat(61), body: "y" }).ok, false);
  assert.equal(cleanBroadcast({ title: "x", body: "y".repeat(281) }).ok, false);
  assert.equal(cleanBroadcast({ title: " ", body: "y" }).ok, false);
  reset();
  const out = await sendBroadcast({ competitionId: COMP, userId: "u1", title: "", body: "y" });
  assert.equal(out.ok, false);
  assert.equal(world.broadcasts.length, 0);
});

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

test("mark read is always scoped to the manager, one or all", async () => {
  reset();
  fake.log.length = 0;
  await notifications.markRead({ managerId: "m1", id: "n1" });
  await notifications.markRead({ managerId: "m1", all: true });
  const updates = fake.log.filter((q) => q.table === "ultima_notifications" && q.op === "update");
  assert.equal(updates.length, 2);
  for (const q of updates) assert.ok(has(q, "eq", "manager_id", "m1"));
  assert.ok(has(updates[0], "eq", "id", "n1"));
  assert.ok(!updates[1].filters.some((f) => f[1] === "id"));
  assert.equal((await notifications.markRead({ managerId: "m1" })).ok, false);
});

test("subscriptions: only https endpoints with both keys are saved", async () => {
  reset();
  fake.log.length = 0;
  const good = { endpoint: "https://push.example/x", keys: { p256dh: "p", auth: "a" } };
  assert.equal((await notifications.saveSubscription({ managerId: "m1", subscription: good })).ok, true);
  assert.equal((await notifications.saveSubscription({ managerId: "m1", subscription: { ...good, endpoint: "http://x" } })).code, "INVALID");
  assert.equal((await notifications.saveSubscription({ managerId: "m1", subscription: { endpoint: good.endpoint } })).code, "INVALID");
  const upserts = fake.log.filter((q) => q.op === "upsert");
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].options.onConflict, "endpoint");
});
