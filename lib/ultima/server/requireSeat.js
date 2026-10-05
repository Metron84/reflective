import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import {
  getAuthContext,
  getSessionResult,
  getVerifiedUser,
} from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { lookupSeat } from "@/lib/ultima/server/db";

function signInHref(returnPath) {
  return `/signin?next=${encodeURIComponent(returnPath)}`;
}

/**
 * Page gate for every Ultima page.
 *
 * Not signed in: redirects to sign-in and returns to `returnPath`.
 * Returns one of:
 *   { status: "seated", auth, manager, competition }   any draft status
 *   { status: "can-join", auth, competition }          join mode, no seat, draft in lobby
 *   { status: "full", auth, competition }              join mode, no seat, draft past lobby
 *   { status: "unavailable" }                          auth or seat lookup failed, show retry
 * Without join mode, a signed-in user with no seat is sent to /ultima.
 * A failed lookup is never reported as "no seat".
 */
export async function requireSeat(returnPath, { join = false } = {}) {
  const auth = await getAuthContext();
  if (!auth.isSignedIn) {
    if (auth.authError) return { status: "unavailable" };
    redirect(signInHref(returnPath));
  }
  if (!auth.profile?.welcome_completed) {
    redirect(`/welcome?next=${encodeURIComponent(returnPath)}`);
  }

  const seat = await lookupSeat(auth.user.id);
  if (seat.status === "unavailable") return { status: "unavailable" };
  if (seat.status === "seated") {
    return { status: "seated", auth, manager: seat.manager, competition: seat.competition };
  }
  if (!join) redirect("/ultima");
  return {
    status: seat.draftState === "lobby" ? "can-join" : "full",
    auth,
    competition: seat.competition,
  };
}

/** Soft variant for pages that render for visitors too (hub, rules). */
export async function peekSeat() {
  const auth = await getAuthContext();
  if (!auth.isSignedIn) {
    return { status: auth.authError ? "unavailable" : "signed-out", auth };
  }
  const seat = await lookupSeat(auth.user.id);
  if (seat.status === "unavailable") return { status: "unavailable", auth };
  return {
    status: seat.status,
    auth,
    manager: seat.manager ?? null,
    competition: seat.competition,
    draftState: seat.draftState ?? null,
  };
}

function fail(code, status) {
  const { body } = ultimaErrorResponse(code, { status });
  return { ok: false, response: NextResponse.json(body, { status }) };
}

/**
 * Signed-in check for API routes. Writes (`mutating`) confirm the user with
 * the Auth server (getUser); reads verify the JWT locally (getClaims).
 * 401 not signed in, 503 auth could not be checked.
 */
export async function requireUserApi({ mutating = false } = {}) {
  const { user, error } = await getSessionResult();
  if (!user) {
    return error ? fail("SEAT_UNAVAILABLE", 503) : fail("SIGN_IN_REQUIRED", 401);
  }
  if (!mutating) return { ok: true, user };

  const verified = await getVerifiedUser();
  if (verified.error) return fail("SEAT_UNAVAILABLE", 503);
  if (!verified.user || verified.user.id !== user.id) {
    return fail("SIGN_IN_REQUIRED", 401);
  }
  return { ok: true, user: verified.user };
}

/**
 * Seat check for API routes. Returns { ok: true, user, manager, competition }
 * or { ok: false, response }. 401 signed out, 403 no seat, 503 lookup failed.
 */
export async function requireSeatApi({ mutating = false } = {}) {
  const gate = await requireUserApi({ mutating });
  if (!gate.ok) return gate;

  const seat = await lookupSeat(gate.user.id);
  if (seat.status === "unavailable") return fail("SEAT_UNAVAILABLE", 503);
  if (seat.status !== "seated") return fail("NO_SEAT", 403);
  return { ok: true, user: gate.user, manager: seat.manager, competition: seat.competition };
}
