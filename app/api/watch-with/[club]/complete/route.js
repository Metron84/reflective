import { completeRun } from "@/lib/watch-with/store";

export const runtime = "nodejs";

export async function POST(request, context) {
  try {
    const { club } = await context.params;
    const body = await request.json().catch(() => null);
    return await completeRun(request, club, body);
  } catch (error) {
    console.error("watch-with/complete", error);
    return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
