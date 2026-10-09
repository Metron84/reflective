import "server-only";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { cardById, getClub, publicCard } from "./clubs";
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEADERS = { "Cache-Control": "no-store" };

export function fail(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: HEADERS });
}

export function ok(body, sessionId, fresh) {
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
  return response;
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

export async function startRun(request, clubSlug) {
  const club = getClub(clubSlug);
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

  const played = await completedToday(client, sessionId, clubSlug);
  if (played >= DAILY_RUN_CAP) {
    return fail("That's five for today. Come back tomorrow.", 429, { code: "daily-cap" });
  }

  const deck = drawDeck(club.cards, club.deckSize || DECK_SIZE).map((card) => card.id);
  if (deck.length < 2) return fail("Not enough companions for a match yet.", 400);

  const { data: created, error } = await client
    .from("watch_with_runs")
    .insert({ session_id: sessionId, club_slug: clubSlug, deck })
    .select("*")
    .single();
  if (error) throw error;
  return ok(presentRun(club, created), sessionId, fresh);
}

async function loadRating(client, clubSlug, cardId) {
  const { data, error } = await client
    .from("watch_with_ratings")
    .select("elo, votes, wins")
    .eq("club_slug", clubSlug)
    .eq("card_id", cardId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { elo: ELO_START, votes: 0, wins: 0, fresh: true };
  return { elo: Number(data.elo), votes: Number(data.votes), wins: Number(data.wins), fresh: false };
}

async function saveRating(client, clubSlug, cardId, previous, nextElo, win) {
  const votes = previous.votes + 1;
  const wins = previous.wins + (win ? 1 : 0);
  if (previous.fresh) {
    const { error } = await client.from("watch_with_ratings").insert({
      club_slug: clubSlug,
      card_id: cardId,
      elo: nextElo,
      votes,
      wins,
    });
    if (error) throw error;
    return;
  }
  const { data, error } = await client
    .from("watch_with_ratings")
    .update({ elo: nextElo, votes, wins })
    .eq("club_slug", clubSlug)
    .eq("card_id", cardId)
    .eq("votes", previous.votes)
    .select("card_id");
  if (error) throw error;
  if (!data?.length) throw new Error("rating-race");
}

export async function recordPick(request, clubSlug, body) {
  const club = getClub(clubSlug);
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

  const winnerRating = await loadRating(client, clubSlug, winnerId);
  const loserRating = await loadRating(client, clubSlug, loserId);
  const next = applyElo(winnerRating.elo, loserRating.elo);
  await saveRating(client, clubSlug, winnerId, winnerRating, next.winnerElo, true);
  await saveRating(client, clubSlug, loserId, loserRating, next.loserElo, false);

  return ok(presentRun(club, claimed[0]), sessionId, false);
}

export async function completeRun(request, clubSlug, body) {
  const club = getClub(clubSlug);
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

export async function rankingFor(clubSlug) {
  const club = getClub(clubSlug);
  if (!club) return null;
  const client = db();
  if (!client) return { club, rows: [], fans: 0, offline: true };

  const { data: ratings, error } = await client
    .from("watch_with_ratings")
    .select("card_id, elo, votes, wins")
    .eq("club_slug", clubSlug)
    .order("elo", { ascending: false });
  if (error) throw error;

  const { data: runs, error: runError } = await client
    .from("watch_with_runs")
    .select("session_id")
    .eq("club_slug", clubSlug)
    .not("completed_at", "is", null);
  if (runError) throw runError;

  const rows = (ratings ?? [])
    .map((row) => {
      const card = cardById(club, row.card_id);
      if (!card) return null;
      return {
        ...publicCard(card),
        elo: Number(row.elo),
        votes: Number(row.votes),
        wins: Number(row.wins),
      };
    })
    .filter(Boolean);

  return {
    club,
    rows,
    fans: new Set((runs ?? []).map((row) => row.session_id)).size,
    offline: false,
  };
}
