/** Runs in the page before the site worker can register. Main site is left alone. */

export function isPlaySwHost(host) {
  const name = String(host || "").split(":")[0].toLowerCase();
  return name === "play.thereflectivefootball.com" || name === "play.localhost";
}

/**
 * Block a new /sw.js registration, drop any worker already installed, and
 * delete its caches. Returns false on every other host.
 */
export async function clearPlayServiceWorker(host, nav, cacheStore) {
  if (!isPlaySwHost(host)) return false;
  const worker = nav?.serviceWorker;
  if (worker && !worker.__trfPlayBlocked) {
    const orig = worker.register?.bind(worker);
    if (typeof worker.register === "function") {
      worker.register = (url, options) => {
        const value = String(url || "");
        if (value.includes("/sw.js") || value.includes("swe-worker")) return Promise.resolve();
        return orig(url, options);
      };
      worker.__trfPlayBlocked = true;
    }
  }
  try {
    const regs = (await worker?.getRegistrations?.()) || [];
    await Promise.all(regs.map((reg) => reg.unregister()));
  } catch {
    // The quiz still plays if the browser refuses the worker API.
  }
  try {
    const keys = (await cacheStore?.keys?.()) || [];
    await Promise.all(keys.map((key) => cacheStore.delete(key)));
  } catch {
    // Same: a failed cache clear must not stop the game.
  }
  return true;
}

/** Inline head script. Serwist registers from the app bundle, so this has to run first. */
export const PLAY_SW_GUARD = `(function(){
  var host = location.hostname;
  if (host !== "play.thereflectivefootball.com" && host !== "play.localhost") return;
  var nav = navigator;
  if (nav.serviceWorker && !nav.serviceWorker.__trfPlayBlocked) {
    var orig = nav.serviceWorker.register.bind(nav.serviceWorker);
    nav.serviceWorker.register = function(url, options) {
      var value = String(url || "");
      if (value.indexOf("/sw.js") !== -1 || value.indexOf("swe-worker") !== -1) return Promise.resolve();
      return orig(url, options);
    };
    nav.serviceWorker.__trfPlayBlocked = true;
    nav.serviceWorker.getRegistrations().then(function(regs) {
      return Promise.all(regs.map(function(reg) { return reg.unregister(); }));
    }).catch(function(){});
  }
  if (window.caches) {
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) { return caches.delete(key); }));
    }).catch(function(){});
  }
})();`;
