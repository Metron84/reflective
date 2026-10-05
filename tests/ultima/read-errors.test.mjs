import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeFakeDb } from "./helpers/fake-db.mjs";

mock.module("@/lib/ultima/server/db", { namedExports: { getUltimaDb: () => null } });
const { strictDb, loggedDb, withReadContext, UltimaReadError } = await import("../../lib/ultima/server/strict-db.js");

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

test("tolerant reads keep their result and log the job name and Supabase message", async () => {
  const lines = [];
  const original = console.error;
  console.error = (...args) => lines.push(args.join(" "));
  try {
    const db = loggedDb(makeFakeDb(() => ({ data: null, error: { message: "relation missing" } })), "notify-cron");
    const result = await withReadContext("cron/ultima/notify", async () =>
      db.from("ultima_notifications").select("id").eq("manager_id", "m1"),
    );
    assert.equal(result.error.message, "relation missing");
    assert.equal(result.data, null);
    const plain = await loggedDb(makeFakeDb(() => ({ data: null, error: { message: "boom" } })), "bots/seat")
      .from("ultima_managers")
      .update({ a: 1 });
    assert.equal(plain.error.message, "boom");
  } finally {
    console.error = original;
  }
  assert.match(lines[0], /\[ultima\/read-error\] cron\/ultima\/notify ultima_notifications: relation missing/);
  assert.match(lines[1], /bots\/seat ultima_managers: boom/);
});
