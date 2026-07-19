import { NextResponse } from "next/server";
import { issueHandoffTimingToken } from "@/lib/concierge/handoffTiming";

export const runtime = "nodejs";

export async function GET() {
  const token = issueHandoffTimingToken();
  if (!token) {
    return NextResponse.json(
      { message: "Timing token unavailable." },
      { status: 503 }
    );
  }
  return NextResponse.json({ token });
}
