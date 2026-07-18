#!/usr/bin/env node
/**
 * Master spec section 11 acceptance tests.
 * Run: node scripts/guesser-acceptance-tests.mjs
 * Requires dev server on port 4343.
 */

const BASE = process.env.GUESSER_TEST_BASE ?? "http://localhost:4343";

async function main() {
  const results = [];

  function log(r) {
    results.push(r);
    console.log(`${r.pass ? "PASS" : "FAIL"}  Test ${r.n}: ${r.name}`);
    if (r.detail) console.log(`       ${r.detail}`);
  }

  // Server-side tests via dev route
  try {
    const res = await fetch(`${BASE}/api/dev/guesser-tests`);
    const data = await res.json();
    for (const r of data.results ?? []) log(r);
  } catch (e) {
    console.error("Could not reach dev test route:", e.message);
    process.exit(1);
  }

  // 6b: live API must not leak answer on failed guess
  try {
    const res = await fetch(`${BASE}/api/guesser/guess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "world_cup", guess: "zzzznotaplayer" }),
    });
    const data = await res.json();
    log({
      n: "6b",
      name: "Failed guess API returns no answer field",
      pass: data.answer == null,
      detail: `status=${res.status} answer=${data.answer ?? "null"}`,
    });
  } catch (e) {
    log({
      n: "6b",
      name: "Failed guess API returns no answer field",
      pass: false,
      detail: e.message,
    });
  }

  // 8: SSR HTML layout
  try {
    const html = await (await fetch(`${BASE}/guesser`)).text();
    log({
      n: 8,
      name: "Six-guess board fits 380px viewport (compact grid, no horizontal scroll)",
      pass:
        html.includes("grid-cols-6") &&
        html.includes("min-w-0") &&
        html.includes("overflow-x-hidden"),
      detail: "grid-cols-6 + overflow-x-hidden in SSR HTML",
    });
  } catch (e) {
    log({
      n: 8,
      name: "Six-guess board fits 380px viewport",
      pass: false,
      detail: e.message,
    });
  }

  // 9: locked mode
  try {
    const html = await (await fetch(`${BASE}/guesser?mode=la_liga`)).text();
    log({
      n: 9,
      name: "?mode=la_liga anonymous shows board shell + signup popup",
      pass:
        html.includes("La Liga") &&
        html.includes("Sign up free") &&
        html.includes("members"),
      detail: "La Liga header + member gate + signup in HTML",
    });
  } catch (e) {
    log({
      n: 9,
      name: "?mode=la_liga anonymous shows board shell + signup popup",
      pass: false,
      detail: e.message,
    });
  }

  // D — home /games links
  try {
    const home = await (await fetch(`${BASE}/`)).text();
    const games = await (await fetch(`${BASE}/games`)).text();
    const guesser = await (await fetch(`${BASE}/guesser`)).text();
    log({
      n: "D",
      name: "Home Games door and /games hero link to Guesser; default is World Cup",
      pass:
        home.includes('href="/games"') &&
        games.includes('href="/guesser"') &&
        guesser.includes("World Cup Legends") &&
        !guesser.includes("Classic"),
      detail: "home→/games, games→/guesser, /guesser hero World Cup Legends",
    });
  } catch (e) {
    log({
      n: "D",
      name: "Home Games door and /games hero link to Guesser",
      pass: false,
      detail: e.message,
    });
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main();
