import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("service worker: push and notificationclick handlers, caching untouched", () => {
  const sw = read("app/sw.js");
  assert.match(sw, /addEventListener\("push"/);
  assert.match(sw, /addEventListener\("notificationclick"/);
  assert.match(sw, /const CACHE_VERSION = "net-v1"/);
  // Ultima documents stay network only; no handler caches a notification.
  assert.match(sw, /isUltimaPath\(pathname\) && isDocumentOrRsc\(request\)[\s\S]{0,40}\n\s*handler: new NetworkOnly\(\)/);
});

test("middleware: /sw.js still skips auth", () => {
  assert.match(read("middleware.js"), /pathname === "\/sw\.js"/);
  assert.match(read("lib/ultima/host.js"), /pathname === "\/sw\.js"/);
});

test("notification routes gate on requireSeatApi or commissioner with the write check", () => {
  for (const file of [
    "app/api/ultima/push/subscribe/route.js",
    "app/api/ultima/push/test/route.js",
    "app/api/ultima/inbox/read/route.js",
  ]) {
    assert.match(read(file), /requireSeatApi\(\{ mutating: true \}\)/, file);
  }
  const broadcast = read("app/api/ultima/admin/broadcast/route.js");
  assert.match(broadcast, /requireUserApi\(\{ mutating: true \}\)/);
  assert.match(broadcast, /requireCommissioner/);
});

test("cron route is behind the CRON_SECRET bearer", () => {
  const route = read("app/api/cron/ultima/notify/route.js");
  assert.match(route, /Bearer \$\{secret\}/);
  assert.match(route, /if \(!secret\) return false/);
});

test("notifications are created in the server code that writes the events", () => {
  const trades = read("lib/ultima/server/trades.js");
  for (const fn of [
    "notifyOfferReceived",
    "notifyOfferAnswered",
    "notifyTradeInReview",
    "notifyTradeSettled",
    "notifyVoidedTrades",
    "notifyExpiredTrades",
  ]) {
    assert.match(trades, new RegExp(`${fn}\\(`), fn);
  }
  assert.match(read("lib/ultima/server/market.js"), /notifyMarketMove\(/);
  assert.match(read("lib/ultima/server/trade-block.js"), /notifyShortlistListed\(/);
  assert.match(read("lib/ultima/server/club-sync.js"), /notifySquadMove\(/);
  // Never from the client.
  for (const file of ["components/ultima/UltimaInboxClient.js", "components/ultima/UltimaPushSettings.js"]) {
    assert.doesNotMatch(read(file), /createNotifications|ultima_notifications/, file);
  }
});

test("permission is asked only on a tap", () => {
  const push = read("components/ultima/UltimaPushSettings.js");
  const useEffects = push.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g) ?? [];
  for (const block of useEffects) assert.doesNotMatch(block, /requestPermission/);
  assert.match(push, /async function turnOn\(\)[\s\S]*Notification\.requestPermission\(\)/);
  assert.match(push, /Add Ultima to your Home Screen to get notifications/);
  assert.match(push, /Turn on notifications/);
  assert.match(push, /Send test notification/);
});

test("the VAPID private key is read in one place and never logged", () => {
  const files = [
    "lib/ultima/server/push.js",
    "lib/ultima/server/notifications.js",
    "lib/ultima/server/notify-cron.js",
    "lib/ultima/server/broadcast.js",
    "app/api/ultima/push/test/route.js",
    "app/api/ultima/push/subscribe/route.js",
  ];
  for (const file of files) {
    const src = read(file);
    if (file.endsWith("push.js")) {
      assert.doesNotMatch(src, /console\.(log|info|error|warn)\([^)]*VAPID_PRIVATE/);
    } else {
      assert.doesNotMatch(src, /VAPID_PRIVATE_KEY/, file);
    }
  }
});

test("new links do not prefetch", () => {
  assert.match(read("components/ultima/UltimaClubBar.js"), /prefetch=\{false\}\s+href="\/ultima\/inbox"/);
});

test("the bell is in the club bar, not the rail", () => {
  const shell = read("components/ultima/UltimaShell.js");
  assert.doesNotMatch(shell.match(/const OFFICE_NAV = \[[\s\S]*?\];/)[0], /inbox/i);
  assert.match(shell, /unread=\{/);
});
