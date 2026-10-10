import { saveFanResult } from "@/lib/watch-with/save";

export const runtime = "nodejs";

export async function POST(request, context) {
  try {
    const { club } = await context.params;
    const body = await request.json().catch(() => null);
    return await saveFanResult(request, club, body);
  } catch (error) {
    console.error("watch-with/save", error);
    return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
