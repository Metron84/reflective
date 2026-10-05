import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeFakeDb } from "./helpers/fake-db.mjs";

mock.module("@/lib/ultima/server/db", { namedExports: { getUltimaDb: () => null } });
const { strictDb, UltimaReadError } = await import("../../lib/ultima/server/strict-db.js");

test("a select that errors rejects instead of returning empty data", async () => {
  const db = strictDb(makeFakeDb(() => ({ data: null, error: { message: "column x does not exist" } })));
  await assert.rejects(
    async () => db.from("ultima_players").select("x").eq("id", 1),
    (e) => e instanceof UltimaReadError && e.label === "ultima_players",
  );
  await assert.rejects(async () => db.from("ultima_players").select("x").maybeSingle());
});

test("a select that works resolves as before", async () => {
  const db = strictDb(makeFakeDb(() => ({ data: [{ id: 1 }], error: null })));
  const { data } = await db.from("ultima_players").select("id").eq("id", 1);
  assert.deepEqual(data, [{ id: 1 }]);
});

test("writes keep their own error handling", async () => {
  const db = strictDb(makeFakeDb(() => ({ data: null, error: { message: "nope" } })));
  const { error } = await db.from("ultima_events").insert({ a: 1 });
  assert.equal(error.message, "nope");
});

test("page loaders say did not load instead of falling back to empty", () => {
  for (const page of ["squad", "log", "inbox"]) {
    const src = readFileSync(`app/ultima/${page}/page.js`, "utf8");
    assert.match(src, /UltimaDidNotLoad/, `${page} page`);
    assert.doesNotMatch(src, /safeResolve/, `${page} page`);
  }
  for (const file of ["squad", "hub"]) {
    const src = readFileSync(`lib/ultima/server/${file}.js`, "utf8");
    assert.doesNotMatch(src, /safeResolve/, `${file} loader`);
  }
});
