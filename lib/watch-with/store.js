import "server-only";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { playableClub, presentClub } from "./access";
import { cardById, publicCard } from "./clubs";
import {
  DAILY_RUN_CAP,
  DECK_SIZE,
  ELO_START,
  MIN_PICK_GAP_MS,
  applyElo,
  drawDeck,
  expectedPair,
  samePair,
} from "./engine";

export const COOKIE = "ww_sid";
const AFFILIATIONS = new Set(["fan", "neutral", "rival"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEADERS = { "Cache-Control": "no-store" };

export function fail(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: HEADERS });
}

export function ok(body, sessionId, fresh, affiliation) {
  const response = NextResponse.json(body, { headers: HEADERS });
  if (fresh) {
    response.cookies.set(COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
    });
  }
  if (affiliation?.name && AFFILIATIONS.has(affiliation.value)) {
    response.cookies.set(affiliation.name, affiliation.value, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

function affiliationOf(request, slug, body) {
  if (AFFILIATIONS.has(body?.affiliation)) return body.affiliation;
  const saved = request.cookies.get(`ww_aff_${slug}`)?.value;
  return AFFILIATIONS.has(saved) ? saved : null;
}

export function readSession(request) {
  const id = request.cookies.get(COOKIE)?.value ?? "";
  return UUID.test(id) ? id : null;
}

export function db() {
  return getServiceClient();
}

function gstDayStartIso() {
  const shifted = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const midnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(midnight - 4 * 60 * 60 * 1000).toISOString();
}

export function presentRun(club, run) {
  const deck = Array.isArray(run.deck) ? run.deck : [];
  const totalPicks = Math.max(0, deck.length - 1);
  const done = run.pick_count >= totalPicks && totalPicks > 0;
  const pairIds = expectedPair(deck, run.pick_count, run.incumbent_id);
  const championId = run.champion_id || (done ? run.incumbent_id : null);
  return {
    runId: run.id,
    pick: done ? totalPicks : run.pick_count + 1,
    totalPicks,
    done: Boolean(run.completed_at) || done,
    needsComplete: done && !run.completed_at,
    incumbentId: run.incumbent_id,
    pair: pairIds ? pairIds.map((id) => publicCard(cardById(club, id))).filter(Boolean) : null,
    champion: championId ? publicCard(cardById(club, championId)) : null,
    deck: deck.map((id) => publicCard(cardById(club, id))).filter(Boolean),
  };
}

async function completedToday(client, sessionId, clubSlug) {
  const { count, error } = await client
    .from("watch_with_runs")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("club_slug", clubSlug)
    .gte("completed_at", gstDayStartIso());
  if (error) throw error;
  return count ?? 0;
}

export async function startRun(request, clubSlug, body) {
  const club = await playableClub(request, clubSlug, body);
  if (!club) return fail("That club is not in the game.", 404);
  const client = db();
  if (!client) return fail("The game is warming up. Try again soon.", 503);

  const existingId = readSession(request);
  const sessionId = existingId ?? crypto.randomUUID();
  const fresh = !existingId;

  const { data: open, error: openError } = await client
    .from("watch_with_runs")
    .select("*")
    .eq("session_id", sessionId)
    .eq("club_slug", clubSlug)
    .is("completed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (openError) throw openError;
  if (open) return ok(presentRun(club, open), sessionId, fresh);

  const affiliation = affiliationOf(request, clubSlug, body);
  if (!affiliation) return ok({ needsAffiliation: true }, sessionId, fresh);

  const played = await completedToday(client, sessionId, clubSlug);
  if (played >= DAILY_RUN_CAP) {
    return fail("That's five for today. Come back tomorrow.", 429, { code: "daily-cap" });
  }

  const deck = drawDeck(club.cards, club.deckSize || DECK_SIZE).map((card) => card.id);
  if (deck.length < 2) return fail("Not enough companions for a match yet.", 400);

  const { data: created, error } = await client
    .from("watch_with_runs")
    .insert({ session_id: sessionId, club_slug: clubSlug, deck, affiliation })
    .select("*")
    .single();
  if (error) throw error;
  return ok(presentRun(club, created), sessionId, fresh, {
    name: `ww_aff_${clubSlug}`,
    value: affiliation,
  });
}

async function loadRating(client, clubSlug, cardId, segment) {
  const { data, error } = await client
    .from("watch_with_ratings")
    .select("elo, votes, wins")
    .eq("club_slug", clubSlug)
    .eq("card_id", cardId)
    .eq("segment", segment)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { elo: ELO_START, votes: 0, wins: 0, fresh: true };
  return { elo: Number(data.elo), votes: Number(data.votes), wins: Number(data.wins), fresh: false };
}

async function applySegments(client, clubSlug, winnerId, loserId, affiliation) {
  const segments = ["all"];
  if (affiliation === "fan" || affiliation === "rival") segments.push(affiliation);
  const payload = [];
  for (const segment of segments) {
    const winnerRating = await loadRating(client, clubSlug, winnerId, segment);
    const loserRating = await loadRating(client, clubSlug, loserId, segment);
    const next = applyElo(winnerRating.elo, loserRating.elo);
    payload.push(
      {
        card_id: winnerId,
        club_slug: clubSlug,
        segment,
        elo: next.winnerElo,
        votes_before: winnerRating.votes,
        win: true,
      },
      {
        card_id: loserId,
        club_slug: clubSlug,
        segment,
        elo: next.loserElo,
        votes_before: loserRating.votes,
        win: false,
      },
    );
  }
  const { error } = await client.rpc("watch_with_apply_ratings", { p_rows: payload });
  if (error) throw error;
}

export async function recordPick(request, clubSlug, body) {
  const club = await playableClub(request, clubSlug, body);
  if (!club) return fail("That club is not in the game.", 404);
  const client = db();
  if (!client) return fail("The game is warming up. Try again soon.", 503);
  const sessionId = readSession(request);
  if (!sessionId) return fail("Start a run first.", 404);

  const runId = typeof body?.runId === "string" ? body.runId : "";
  const winnerId = typeof body?.winnerId === "string" ? body.winnerId : "";
  const loserId = typeof body?.loserId === "string" ? body.loserId : "";
  if (!UUID.test(runId)) return fail("That run is not valid.");

  const { data: run, error: runError } = await client
    .from("watch_with_runs")
    .select("*")
    .eq("id", runId)
    .eq("session_id", sessionId)
    .eq("club_slug", clubSlug)
    .maybeSingle();
  if (runError) throw runError;
  if (!run) return fail("Your run was not found.", 404);
  if (run.completed_at) return fail("This run is already finished.", 409, { state: presentRun(club, run) });

  if (run.last_pick_at && Date.now() - new Date(run.last_pick_at).getTime() < MIN_PICK_GAP_MS) {
    return fail("That was too quick. Pick again.");
  }

  const deck = Array.isArray(run.deck) ? run.deck : [];
  const pair = expectedPair(deck, run.pick_count, run.incumbent_id);
  if (!samePair(pair, winnerId, loserId)) {
    return fail("That pair is not in this run.", 400, { state: presentRun(club, run) });
  }
  if (!cardById(club, winnerId) || !cardById(club, loserId)) {
    return fail("That companion is not in this club.");
  }

  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await client
    .from("watch_with_runs")
    .update({
      pick_count: run.pick_count + 1,
      incumbent_id: winnerId,
      last_pick_at: now,
    })
    .eq("id", run.id)
    .eq("pick_count", run.pick_count)
    .is("completed_at", null)
    .select("*");
  if (claimError) throw claimError;
  if (!claimed?.length) return fail("That pick was already counted.", 409);

  const { error: swipeError } = await client.from("watch_with_swipes").insert({
    run_id: run.id,
    session_id: sessionId,
    winner_id: winnerId,
    loser_id: loserId,
    club_slug: clubSlug,
    step: run.pick_count + 1,
  });
  if (swipeError) throw swipeError;

  await applySegments(client, clubSlug, winnerId, loserId, run.affiliation);

  return ok(presentRun(club, claimed[0]), sessionId, false);
}

export async function completeRun(request, clubSlug, body) {
  const club = await playableClub(request, clubSlug, body);
  if (!club) return fail("That club is not in the game.", 404);
  const client = db();
  if (!client) return fail("The game is warming up. Try again soon.", 503);
  const sessionId = readSession(request);
  if (!sessionId) return fail("Start a run first.", 404);

  const runId = typeof body?.runId === "string" ? body.runId : "";
  const championId = typeof body?.championId === "string" ? body.championId : "";
  if (!UUID.test(runId) || !championId) return fail("That result is not valid.");

  const { data: run, error } = await client
    .from("watch_with_runs")
    .select("*")
    .eq("id", runId)
    .eq("session_id", sessionId)
    .eq("club_slug", clubSlug)
    .maybeSingle();
  if (error) throw error;
  if (!run) return fail("Your run was not found.", 404);

  const deck = Array.isArray(run.deck) ? run.deck : [];
  const totalPicks = deck.length - 1;
  if (run.pick_count !== totalPicks || run.incumbent_id !== championId) {
    return fail("Finish the picks before crowning a companion.");
  }
  if (!cardById(club, championId)) return fail("That companion is not in this club.");

  if (run.completed_at) return ok(presentRun(club, run), sessionId, false);

  const played = await completedToday(client, sessionId, clubSlug);
  if (played >= DAILY_RUN_CAP) {
    return fail("That's five for today. Come back tomorrow.", 429, { code: "daily-cap" });
  }

  const { data: saved, error: saveError } = await client
    .from("watch_with_runs")
    .update({ champion_id: championId, completed_at: new Date().toISOString() })
    .eq("id", run.id)
    .is("completed_at", null)
    .select("*")
    .single();
  if (saveError) throw saveError;
  return ok(presentRun(club, saved), sessionId, false);
}

function ratedRows(club, ratings, segment) {
  const byCard = new Map();
  for (const row of ratings ?? []) {
    if (row.segment !== segment) continue;
    byCard.set(row.card_id, row);
  }
  return (club.cards ?? [])
    .filter((card) => card.active || byCard.has(card.id))
    .map((card) => {
      const row = byCard.get(card.id);
      return {
        ...publicCard(card),
        elo: row ? Number(row.elo) : ELO_START,
        votes: row ? Number(row.votes) : 0,
        wins: row ? Number(row.wins) : 0,
      };
    });
}

export async function rankingFor(clubSlug) {
  const club = await presentClub(clubSlug);
  if (!club) return null;
  const client = db();
  if (!client) {
    return {
      club,
      segments: { all: [], fan: [], rival: [], verified: [] },
      runs: { all: 0, fan: 0, rival: 0 },
      verifiedFans: 0,
      offline: true,
    };
  }

  const { data: ratings, error } = await client
    .from("watch_with_ratings")
    .select("card_id, segment, elo, votes, wins")
    .eq("club_slug", clubSlug);
  if (error) throw error;

  const { data: runs, error: runError } = await client
    .from("watch_with_runs")
    .select("affiliation")
    .eq("club_slug", clubSlug)
    .not("completed_at", "is", null);
  if (runError) throw runError;

  const finished = runs ?? [];
  let verifiedRows = [];
  let verifiedFans = 0;
  try {
    const { data: verified, error: verifiedError } = await client
      .from("watch_with_verified_results")
      .select("card_id, wins, votes, win_rate")
      .eq("club_slug", clubSlug);
    if (verifiedError) throw verifiedError;
    const byCard = new Map((verified ?? []).map((row) => [row.card_id, row]));
    verifiedRows = (club.cards ?? [])
      .filter((card) => card.active || byCard.has(card.id))
      .map((card) => {
        const row = byCard.get(card.id);
        const votes = row ? Number(row.votes) : 0;
        const wins = row ? Number(row.wins) : 0;
        return {
          ...publicCard(card),
          elo: 0,
          votes,
          wins,
          winRate: votes ? wins / votes : 0,
        };
      });
    const { data: linked, error: linkedError } = await client
      .from("watch_with_runs")
      .select("fan_id")
      .eq("club_slug", clubSlug)
      .not("fan_id", "is", null)
      .not("completed_at", "is", null);
    if (linkedError) throw linkedError;
    const ids = [...new Set((linked ?? []).map((row) => row.fan_id).filter(Boolean))];
    if (ids.length) {
      const { data: fans, error: fanError } = await client
        .from("watch_with_fans")
        .select("id, email_verified")
        .in("id", ids);
      if (fanError) throw fanError;
      verifiedFans = (fans ?? []).filter((row) => row.email_verified).length;
    }
  } catch (error) {
    console.error("watch-with/verified", error);
  }

  return {
    club,
    segments: {
      all: ratedRows(club, ratings, "all"),
      fan: ratedRows(club, ratings, "fan"),
      rival: ratedRows(club, ratings, "rival"),
      verified: verifiedRows,
    },
    runs: {
      all: finished.length,
      fan: finished.filter((row) => row.affiliation === "fan").length,
      rival: finished.filter((row) => row.affiliation === "rival").length,
    },
    verifiedFans,
    offline: false,
  };
}
