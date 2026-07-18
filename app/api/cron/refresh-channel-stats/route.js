import { NextResponse } from "next/server";
import { refreshChannelStatsForCron } from "@/lib/stats/views";

export const dynamic = "force-dynamic";

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshChannelStatsForCron();

  if (!result.ok) {
    const status = result.error === "supabase_unavailable" ? 503 : 502;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
