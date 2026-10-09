import { startRun } from "@/lib/watch-with/store";

export const runtime = "nodejs";

export async function POST(request, context) {
  try {
    const { club } = await context.params;
    return await startRun(request, club);
  } catch (error) {
    console.error("watch-with/start", error);
    return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
