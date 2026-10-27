import test from "node:test";
import assert from "node:assert/strict";
import {
  HOST_MAP,
  appForHost,
  canonicalUrl,
  hostAction,
  hubUrl,
  manifestForHost,
  returnOrigin,
} from "../../lib/hosts.js";
import { withAuthCookieDomain } from "../../lib/ultima/host.js";

const CASES = [
  ["play", "/play"],
  ["ultima", "/ultima"],
  ["codemaster", "/codemaster"],
  ["guesser", "/guesser"],
  ["crest", "/crest"],
  ["concierge", "/concierge"],
  ["events", "/events"],
  ["compete", "/compete"],
  ["observatory", "/observatory"],
  ["watchwith", "/watch-with"],
];

test("each app host rewrites its root onto its route", () => {
  for (const [slug, target] of CASES) {
    const host = `${slug}.thereflectivefootball.com`;
    assert.equal(appForHost(host)?.target, target, slug);
    assert.deepEqual(hostAction(host, "/"), { type: "rewrite", to: target }, slug);
    assert.deepEqual(hostAction(`${slug}.localhost`, "/"), { type: "rewrite", to: target }, slug);
  }
});

test("a path already inside the app is not rewritten again", () => {
  assert.deepEqual(hostAction("crest.thereflectivefootball.com", "/crest"), { type: "pass" });
  assert.deepEqual(hostAction("ultima.thereflectivefootball.com", "/ultima/squad"), { type: "pass" });
  assert.deepEqual(hostAction("play.thereflectivefootball.com", "/films"), { type: "rewrite", to: "/play/films" });
});

test("static, api, brand, manifest and the service worker pass through", () => {
  for (const path of ["/api/crest/result", "/_next/static/a.js", "/brand/trf-icon-192.png", "/manifest.webmanifest", "/sw.js"]) {
    assert.deepEqual(hostAction("play.thereflectivefootball.com", path), { type: "pass" }, path);
  }
});

test("the hub is not an app host", () => {
  assert.equal(appForHost("www.thereflectivefootball.com"), null);
  assert.equal(appForHost("thereflectivefootball.com"), null);
  assert.deepEqual(hostAction("www.thereflectivefootball.com", "/"), { type: "pass" });
});

test("subdomain canonicals use the www hub and the app path", () => {
  assert.equal(
    canonicalUrl("play.thereflectivefootball.com", "/"),
    "https://www.thereflectivefootball.com/play",
  );
  assert.equal(
    canonicalUrl("watchwith.thereflectivefootball.com", "/west-ham"),
    "https://www.thereflectivefootball.com/watch-with/west-ham",
  );
  assert.equal(canonicalUrl("www.thereflectivefootball.com", "/films"), null);
});

test("a link that leaves an app is an absolute www url", () => {
  assert.equal(hubUrl("/films", "events.thereflectivefootball.com"), "https://www.thereflectivefootball.com/films");
  assert.equal(hubUrl("/events", "events.thereflectivefootball.com"), "/events");
  assert.equal(hubUrl("/films", "www.thereflectivefootball.com"), "/films");
});

test("manifest names follow the host and fall back to the TRF icons", () => {
  const play = manifestForHost("play.thereflectivefootball.com", () => false);
  assert.equal(play.short_name, "Fan Quiz");
  assert.equal(play.start_url, "/");
  assert.equal(play.scope, "/");
  assert.equal(play.display, "standalone");
  assert.equal(play.theme_color, "#0A111F");
  assert.equal(play.background_color, "#F2EDE4");
  assert.equal(play.icons[0].src, "/brand/trf-icon-192.png");

  const own = manifestForHost("crest.thereflectivefootball.com", (src) => src.includes("/brand/apps/crest-"));
  assert.equal(own.short_name, "The Crest");
  assert.equal(own.icons[0].src, "/brand/apps/crest-192.png");
  assert.equal(own.icons[1].src, "/brand/apps/crest-maskable-192.png");

  const ultima = manifestForHost("ultima.thereflectivefootball.com");
  assert.equal(ultima.short_name, "Ultima");
  assert.equal(ultima.theme_color, "#12151C");
  assert.equal(ultima.background_color, "#12151C");

  assert.equal(manifestForHost("www.thereflectivefootball.com").short_name, "TRF");
  assert.equal(HOST_MAP.length, CASES.length);
});

test("the callback only returns to one of our hosts", () => {
  assert.equal(
    returnOrigin("play.thereflectivefootball.com", "https://www.thereflectivefootball.com"),
    "https://play.thereflectivefootball.com",
  );
  assert.equal(
    returnOrigin("play.localhost:4343", "https://www.thereflectivefootball.com"),
    "http://play.localhost:4343",
  );
  assert.equal(returnOrigin("evil.example", "https://www.thereflectivefootball.com"), "https://www.thereflectivefootball.com");
});

test("the shared auth cookie is set only in production", () => {
  const previous = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  assert.equal(withAuthCookieDomain({}, "play.thereflectivefootball.com").domain, undefined);
  process.env.VERCEL_ENV = "production";
  assert.equal(withAuthCookieDomain({}, "play.thereflectivefootball.com").domain, ".thereflectivefootball.com");
  if (previous === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = previous;
});
