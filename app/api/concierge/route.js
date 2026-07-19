import { NextResponse } from "next/server";
import { runConcierge } from "@/lib/concierge/llm";
import { CONCIERGE_SYSTEM_PROMPT } from "@/lib/concierge/systemPrompt";
import { CONCIERGE_TOOLS } from "@/lib/concierge/tools";
import { getClientIp, rateLimited } from "@/lib/concierge/rateLimit";

export const runtime = "nodejs";

const MAX_MESSAGES = 24;

function normalizeMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const m of raw.slice(-MAX_MESSAGES)) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
    const content = typeof m.content === "string" ? m.content.trim() : "";
    if (!content) continue;
    out.push({ role: m.role, content });
  }
  return out.length ? out : null;
}

const SEARCH_TOOLS = new Set(["search_videos", "search_venues"]);

/**
 * @returns {{ reply: string, results: object[], handoff: false | "full" | "light" }}
 */
function assembleClientPayload(text, toolResultsUsed) {
  let relationshipHandoff = false;
  let searched = false;
  /** @type {Array<object>} */
  let cardResults = [];

  for (const used of toolResultsUsed ?? []) {
    const output = used.output ?? {};
    if (SEARCH_TOOLS.has(used.name)) searched = true;
    if (output.handoff || used.name === "handoff_to_melo") {
      relationshipHandoff = true;
    }
    if (Array.isArray(output.results) && output.results.length) {
      cardResults = [...cardResults, ...output.results];
    }
  }

  const seen = new Set();
  const results = [];
  for (const item of cardResults) {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(item);
  }

  /** @type {false | "full" | "light"} */
  let handoff = false;
  if (relationshipHandoff) {
    handoff = "full";
  } else if (searched && results.length === 0) {
    // Light only when search tools ran and assembled cards are empty.
    // Clarifying turns (no search tools) stay false.
    handoff = "light";
  }

  const reply =
    (text && String(text).trim()) ||
    (handoff === "full"
      ? "That one is for Melo. Write him at melo@thereflectivefootball.com."
      : "The archive does not cover that yet. Try another angle, or ask Melo.");

  return {
    reply,
    results: handoff === "full" ? [] : results,
    handoff,
  };
}

export async function POST(request) {
  const ip = getClientIp(request);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { message: "Too many requests. Try again shortly." },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const messages = normalizeMessages(body?.messages);
  if (!messages) {
    return NextResponse.json(
      { message: "messages array with user/assistant turns is required." },
      { status: 400 }
    );
  }
  if (messages[messages.length - 1].role !== "user") {
    return NextResponse.json(
      { message: "Last message must be from the user." },
      { status: 400 }
    );
  }

  try {
    const { text, toolResultsUsed } = await runConcierge({
      messages,
      tools: CONCIERGE_TOOLS,
      systemPrompt: CONCIERGE_SYSTEM_PROMPT,
    });
    return NextResponse.json(assembleClientPayload(text, toolResultsUsed));
  } catch (err) {
    const status = err?.status >= 400 && err?.status < 600 ? err.status : 502;
    return NextResponse.json(
      { message: err?.message ?? "Concierge request failed." },
      { status }
    );
  }
}
