import test from "node:test";
import assert from "node:assert/strict";
import { manifestForSubdomain } from "../../lib/subdomains.js";

test("play, codemaster and the bare domain each get their own manifest", () => {
  const play = manifestForSubdomain("play.thereflectivefootball.com", () => false);
  assert.equal(play.name, "Are You Really a Fan?");
  assert.equal(play.short_name, "Real Fan?");
  assert.equal(play.id, "/play");
  assert.equal(play.start_url, "/");
  assert.equal(play.scope, "/");
  assert.equal(play.display, "standalone");
  assert.equal(play.orientation, "portrait");
  assert.equal(play.theme_color, "#0A111F");
  assert.equal(play.background_color, "#F2EDE4");
  assert.match(play.description, /Spin the wheel/);
  assert.equal(play.icons[0].src, "/brand/trf-icon-192.png");
  assert.equal(play.icons[1].src, "/brand/trf-icon-512.png");
  assert.equal(play.icons[2].src, "/brand/trf-maskable-512.png");

  const code = manifestForSubdomain("codemaster.thereflectivefootball.com", (src) =>
    src === "/icons/codemaster/icon-192.png",
  );
  assert.equal(code.name, "Codemaster");
  assert.equal(code.short_name, "Codemaster");
  assert.equal(code.id, "/codemaster");
  assert.equal(code.icons[0].src, "/icons/codemaster/icon-192.png");
  assert.equal(code.icons[1].src, "/brand/trf-icon-512.png");
  assert.match(code.description, /Codemaster/);

  for (const host of ["thereflectivefootball.com", "www.thereflectivefootball.com", null]) {
    const hub = manifestForSubdomain(host, () => false);
    assert.equal(hub.name, "The Reflective Football", String(host));
    assert.equal(hub.short_name, "TRF", String(host));
    assert.equal(hub.start_url, "/");
    assert.equal(hub.scope, "/");
    assert.equal(hub.display, "standalone");
    assert.equal(hub.theme_color, "#0A111F");
    assert.equal(hub.background_color, "#F2EDE4");
    assert.equal(hub.id, undefined, String(host));
    assert.equal(hub.orientation, undefined, String(host));
    assert.equal(hub.icons[0].src, "/brand/trf-icon-192.png");
    assert.equal(hub.icons[1].src, "/brand/trf-maskable-192.png");
  }
});
