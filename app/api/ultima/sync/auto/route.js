import { NextResponse } from "next/server";
import { AUTO_SYNC_BATCH_SIZE, runUltimaAutoSync } from "@/lib/ultima/server/auto-sync";
import { withReadContext } from "@/lib/ultima/server/strict-db";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

function isAuthorized(request) {
  const secret = process.env.ULTIMA_CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("x-cron-secret") === secret;
}

async function handle(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const cursor = Number(url.searchParams.get("cursor") || 0);
  const batchSize = Number(url.searchParams.get("batch") || AUTO_SYNC_BATCH_SIZE);
  const gameweekId = url.searchParams.get("gameweek") || null;

  const result = await runUltimaAutoSync({
    gameweekId: gameweekId && /^[0-9a-f-]{36}$/i.test(gameweekId) ? gameweekId : null,
    cursor: Number.isFinite(cursor) ? cursor : 0,
    batchSize: Number.isFinite(batchSize) ? batchSize : AUTO_SYNC_BATCH_SIZE,
    force: false,
    rescore: true,
  });

  const status = result.error === "no_db" ? 500 : 200;
  return NextResponse.json(result, { status });
}

export async function GET(request) {
  return withReadContext("ultima/sync/auto", () => handle(request));
}

export async function POST(request) {
  return withReadContext("ultima/sync/auto", () => handle(request));
}
