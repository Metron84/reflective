import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PLAY_SW_GUARD, clearPlayServiceWorker } from "../../lib/play/sw-cleanup.js";

test("the play host drops an installed worker and the main site does not", async () => {
  const calls = [];
  const nav = {
    serviceWorker: {
      async getRegistrations() {
        return [{ unregister: async () => calls.push("unregister") }];
      },
      register() {
        calls.push("register");
        return Promise.resolve();
      },
    },
  };
  const cacheStore = {
    keys: async () => ["precache"],
    delete: async (key) => {
      calls.push(key);
      return true;
    },
  };

  assert.equal(await clearPlayServiceWorker("www.thereflectivefootball.com", nav, cacheStore), false);
  assert.deepEqual(calls, []);

  assert.equal(await clearPlayServiceWorker("play.thereflectivefootball.com", nav, cacheStore), true);
  assert.deepEqual(calls, ["unregister", "precache"]);
  await nav.serviceWorker.register("/sw.js");
  assert.deepEqual(calls, ["unregister", "precache"]);
});

test("the guard script is injected only for the play host", () => {
  const layout = readFileSync(new URL("../../app/layout.js", import.meta.url), "utf8");
  const sw = readFileSync(new URL("../../app/sw.js", import.meta.url), "utf8");
  assert.match(layout, /\{playApp \? <script dangerouslySetInnerHTML=\{\{ __html: PLAY_SW_GUARD \}\} \/> : null\}/);
  assert.match(PLAY_SW_GUARD, /play\.thereflectivefootball\.com/);
  assert.match(PLAY_SW_GUARD, /unregister/);
  assert.match(PLAY_SW_GUARD, /caches\.delete/);
  assert.match(sw, /isPlayWorkerHost\(\)/);
  assert.match(sw, /self\.registration\.unregister\(\)/);
  assert.match(sw, /pathname === "\/api\/play" \|\| pathname\.startsWith\("\/api\/play\/"\)/);
});
