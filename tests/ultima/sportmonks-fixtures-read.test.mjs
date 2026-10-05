import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { SportmonksProvider } from "@/lib/ultima/provider/sportmonks";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
process.env.SPORTMONKS_API_KEY = "test-key";
process.env.SPORTMONKS_LEAGUE_ID_LALIGA = "564";

const fixture = (id, at) => ({ id, starting_at: at, state: { short_name: "NS" }, participants: [], scores: [] });

function fakeApi(handler) {
  const calls = [];
  globalThis.fetch = async (url) => {
    const u = new URL(String(url));
    const m = u.pathname.match(/between\/(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})/);
    const page = Number(u.searchParams.get("page") ?? 1);
    calls.push({ from: m[1], to: m[2], page });
    const body = handler({ from: m[1], to: m[2], page });
    return { ok: true, status: 200, json: async () => body };
  };
  return calls;
}

test("every page of a chunk is read until has_more is false", async () => {
  const calls = fakeApi(({ page }) => ({
    data: [fixture(page * 10, "2026-10-10 14:00:00"), fixture(page * 10 + 1, "2026-10-10 16:00:00")],
    pagination: { has_more: page < 3 },
  }));
  const out = await new SportmonksProvider().fetchFixtures("laliga", "2026-10-09", "2026-10-15");
  assert.equal(out.length, 6);
  assert.deepEqual(calls.map((c) => c.page), [1, 2, 3]);
});

test("a season-long range is read in chunks of 90 days with no gap and no overlap", async () => {
  const calls = fakeApi(() => ({ data: [], pagination: { has_more: false } }));
  await new SportmonksProvider().fetchFixtures("laliga", "2026-10-09", "2027-06-30");
  assert.equal(calls[0].from, "2026-10-09");
  assert.equal(calls.at(-1).to, "2027-06-30");
  for (let i = 1; i < calls.length; i += 1) {
    const prevEnd = new Date(`${calls[i - 1].to}T00:00:00Z`).getTime();
    assert.equal(new Date(`${calls[i].from}T00:00:00Z`).getTime(), prevEnd + 24 * 3600 * 1000);
  }
  assert.ok(calls.length >= 3);
});

test("a fixture returned twice is kept once", async () => {
  fakeApi(() => ({ data: [fixture(7, "2026-10-10 14:00:00"), fixture(7, "2026-10-10 14:00:00")], pagination: { has_more: false } }));
  const out = await new SportmonksProvider().fetchFixtures("laliga", "2026-10-09", "2026-10-15");
  assert.equal(out.length, 1);
});

test("a chunk that never stops paging fails loudly instead of returning a partial season", async () => {
  fakeApi(({ page }) => ({ data: [fixture(page, "2026-10-10 14:00:00")], pagination: { has_more: true } }));
  await assert.rejects(new SportmonksProvider().fetchFixtures("laliga", "2026-10-09", "2026-10-15"), /exceed/);
});
