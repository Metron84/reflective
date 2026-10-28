import test from "node:test";
import assert from "node:assert/strict";
import { isPlayHost, isPlayPassthrough, mainSiteOrigin, playHostAction, signInHrefFor } from "@/lib/play/host.js";
import { isUltimaAppHost } from "@/lib/ultima/host.js";

test("isPlayHost matches the subdomain and play.localhost, with or without a port", () => {
  for (const h of ["play.thereflectivefootball.com", "PLAY.thereflectivefootball.com:443", "play.localhost", "play.localhost:4343"]) {
    assert.equal(isPlayHost(h), true, h);
  }
  for (const h of ["thereflectivefootball.com", "www.thereflectivefootball.com", "ultima.thereflectivefootball.com", "localhost:4343", "", null, "play.example.com", "notplay.thereflectivefootball.com"]) {
    assert.equal(isPlayHost(h), false, String(h));
  }
});

test("the play host does not claim the Ultima host and the reverse", () => {
  assert.equal(isUltimaAppHost("play.thereflectivefootball.com"), false);
  assert.equal(isPlayHost("ultima.thereflectivefootball.com"), false);
});

test("root is rewritten to /play so the URL stays clean", () => {
  assert.deepEqual(playHostAction("/"), { type: "rewrite", to: "/play" });
});

test("game API, auth, sign-in, next assets, static files and manifest pass through", () => {
  for (const p of [
    "/api/play/session", "/api/play/claim", "/api/other", "/auth/callback", "/auth/signout", "/signin",
    "/welcome", "/_next/static/chunks/a.js", "/_next/image", "/brand/trf-crest-transparent.png",
    "/favicon.ico", "/manifest.webmanifest", "/sw.js", "/robots.txt", "/images/x.webp", "/offline",
  ]) {
    assert.deepEqual(playHostAction(p), { type: "pass" }, p);
  }
});

test("a path outside the play section rewrites, and a hub page leaves", () => {
  assert.deepEqual(playHostAction("/chapter/3"), { type: "rewrite", to: "/play/chapter/3" });
  assert.deepEqual(playHostAction("/films"), {
    type: "redirect",
    to: "https://thereflectivefootball.com/films",
  });
  assert.deepEqual(playHostAction("/guesser"), {
    type: "redirect",
    to: "https://thereflectivefootball.com/guesser",
  });
});

test("a path already under /play is left alone", () => {
  assert.deepEqual(playHostAction("/play"), { type: "pass" });
  assert.deepEqual(playHostAction("/play/score"), { type: "pass" });
});

test("passthrough is exact about prefixes", () => {
  assert.equal(isPlayPassthrough("/api/play"), true);
  assert.equal(isPlayPassthrough("/api/playground"), true);
  assert.equal(isPlayPassthrough("/authors"), false);
  assert.equal(isPlayPassthrough("/brandx"), false);
});

test("sign-in returns to the host the player started on", () => {
  assert.equal(signInHrefFor("play.thereflectivefootball.com"), "/signin?next=%2F%3Fsave%3D1");
  assert.equal(signInHrefFor("play.localhost:4343"), "/signin?next=%2F%3Fsave%3D1");
  assert.equal(signInHrefFor("www.thereflectivefootball.com"), "/signin?next=%2Fplay%3Fsave%3D1");
});

test("links off the play host point at the main site", () => {
  assert.equal(mainSiteOrigin("play.thereflectivefootball.com"), "https://www.thereflectivefootball.com");
  assert.equal(mainSiteOrigin("play.localhost:4343"), "http://localhost:4343");
});
