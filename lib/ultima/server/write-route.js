import { NextResponse } from "next/server";
import {
  claimActionKey,
  finishActionKey,
  maybePurgeActionKeys,
  readActionKey,
  releaseActionKey,
} from "@/lib/ultima/server/action-keys";

/** One timing line per write, so slow routes show up in the logs. */
export function logWriteTiming(route, ms, status) {
  console.log(`[ultima/timing] route=${route} ms=${Math.round(ms)} status=${status}`);
}

/** A write that changed nothing and may be tried again with the same key. */
function retryable(status) {
  return status >= 500 || status === 429;
}

/**
 * Run one write route.
 *
 * handler() returns { status, body }. With an Idempotency-Key header the first
 * request claims the key and the outcome is stored; a repeated key returns the
 * stored outcome and writes nothing. Without the header the write just runs.
 * Every call logs its route name and duration.
 */
export async function runWrite({ route, request, manager, handler }) {
  const started = performance.now();
  const key = readActionKey(request);
  let claim = { state: "skip" };
  if (key && manager?.id) {
    claim = await claimActionKey({ key, managerId: manager.id, route });
  }

  if (claim.state === "replay") {
    const { status, body } = claim.result;
    logWriteTiming(route, performance.now() - started, `${status}:replay`);
    return NextResponse.json(body, { status, headers: { "Idempotent-Replay": "true" } });
  }
  if (claim.state === "busy") {
    logWriteTiming(route, performance.now() - started, "409:busy");
    return NextResponse.json(
      { code: "IN_PROGRESS", message: "Still working on your last tap." },
      { status: 409 },
    );
  }
  if (claim.state === "mismatch") {
    logWriteTiming(route, performance.now() - started, "422:mismatch");
    return NextResponse.json(
      { code: "INVALID", message: "That request key was used for something else." },
      { status: 422 },
    );
  }

  let outcome;
  try {
    outcome = await handler();
  } catch (error) {
    console.error(`[ultima/write] ${route} threw`, error?.message || error);
    outcome = { status: 500, body: { code: "UNAVAILABLE", message: "That did not go through. Try again." } };
  }

  const status = outcome.status ?? 200;
  logWriteTiming(route, performance.now() - started, status);

  if (claim.state === "claimed") {
    if (retryable(status)) await releaseActionKey({ key, managerId: manager.id });
    else await finishActionKey({ key, managerId: manager.id, result: { status, body: outcome.body } });
    await maybePurgeActionKeys();
  }

  return NextResponse.json(outcome.body, { status });
}
