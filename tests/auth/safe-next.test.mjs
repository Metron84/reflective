import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedReturnHost, safeNextPath } from "../../lib/auth/safe-next.js";
import { programmeAccountHref } from "../../lib/programme/links.js";

test("a plain path is allowed", () => {
  assert.equal(safeNextPath("/account"), "/account");
  assert.equal(safeNextPath("/crest?save=1"), "/crest?save=1");
});

test("a Reflective subdomain is allowed", () => {
  assert.equal(isAllowedReturnHost("play.thereflectivefootball.com"), true);
  assert.equal(isAllowedReturnHost("www.thereflectivefootball.com"), true);
  assert.equal(
    safeNextPath("https://crest.thereflectivefootball.com/crest"),
    "https://crest.thereflectivefootball.com/crest",
  );
  assert.equal(
    safeNextPath("https://thereflectivefootball.com/account"),
    "https://thereflectivefootball.com/account",
  );
});

test("a foreign domain is rejected", () => {
  assert.equal(isAllowedReturnHost("evil.com"), false);
  assert.equal(isAllowedReturnHost("thereflectivefootball.com.evil.com"), false);
  assert.equal(safeNextPath("https://evil.com/account"), "/");
  assert.equal(safeNextPath("https://notthereflectivefootball.com/account"), "/");
  assert.equal(safeNextPath("//evil.com"), "/");
});

test("My Programme on a subdomain points at the main domain", () => {
  assert.equal(
    programmeAccountHref("crest.thereflectivefootball.com"),
    "https://thereflectivefootball.com/account",
  );
  assert.equal(programmeAccountHref("www.thereflectivefootball.com"), "/account");
  assert.equal(programmeAccountHref(""), "/account");
});
