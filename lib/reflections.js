import { readFileSync, existsSync } from "fs";
import path from "path";
import { cookies } from "next/headers";
import { REFLECTIONS_CATEGORIES, getOpenCategorySlugs } from "./config";
import { getServiceClient } from "./supabase";
import { SAMPLE_NOMINEES } from "./sample-nominees";
import { verifyPayload } from "./signing";

export const VOTES_COOKIE = "trf_votes";

const SEED_FILES = {
  "best-video": "content/reflections/best-video-nominees.json",
  "best-supporters-club": "content/reflections/best-supporters-club-nominees.json",
  "best-celebration": "content/reflections/best-celebration-nominees.json",
};

function loadSeedNominees(category) {
  const rel = SEED_FILES[category];
  if (!rel) return [];
  const file = path.join(process.cwd(), rel);
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, "utf8"));
}

function sampleForCategory(category) {
  return SAMPLE_NOMINEES.filter((n) => n.category === category);
}

/** All nominee rows for a category: DB → seed file → SAMPLE (open only). */
async function nomineesForCategory(category, dbRows) {
  const fromDb = dbRows.filter((r) => r.category === category);
  if (fromDb.length) return fromDb;

  const fromSeed = loadSeedNominees(category);
  if (fromSeed.length) return fromSeed;

  if (getOpenCategorySlugs().includes(category)) {
    return sampleForCategory(category);
  }

  return [];
}

// Returns nominees grouped by category slug. Per-category resolution so
// staged rollouts work: one live category while others stay empty.
export async function getNomineesByCategory() {
  let dbRows = [];
  const supabase = getServiceClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("nominees")
      .select(
        "id, category, title, youtube_id, clip_url, context_line, sort, clip_start_seconds"
      )
      .order("sort", { ascending: true });
    if (!error && data?.length) dbRows = data;
  }

  const grouped = {};
  for (const slug of getOpenCategorySlugs()) {
    grouped[slug] = await nomineesForCategory(slug, dbRows);
  }
  // Closed categories: only DB rows if Melo inserted early; otherwise empty.
  for (const cat of REFLECTIONS_CATEGORIES) {
    if (cat.open) continue;
    const fromDb = dbRows.filter((r) => r.category === cat.slug);
    grouped[cat.slug] = fromDb;
  }

  return grouped;
}

/** Lookup for vote validation when Supabase is off or as fallback. */
export async function findNomineeById(nomineeId) {
  const grouped = await getNomineesByCategory();
  for (const rows of Object.values(grouped)) {
    const hit = rows.find((n) => n.id === nomineeId);
    if (hit) return hit;
  }
  return null;
}

// Categories and picks this browser already voted for, from the
// signed cookie. UX convenience only; votes table is source of truth.
export async function getVoteCookieState() {
  const store = await cookies();
  const token = store.get(VOTES_COOKIE)?.value;
  const payload = verifyPayload(token);
  return {
    categories: Array.isArray(payload?.categories) ? payload.categories : [],
    picks: payload?.picks && typeof payload.picks === "object" ? payload.picks : {},
  };
}

/** Signed-in member picks from votes table (source of truth over cookie). */
export async function getUserReflectionsVotes(userId) {
  if (!userId) return { categories: [], picks: {} };
  const supabase = getServiceClient();
  if (!supabase) return { categories: [], picks: {} };

  const { data } = await supabase
    .from("votes")
    .select("category, nominee_id")
    .eq("user_id", userId);

  const picks = Object.fromEntries(
    (data ?? []).map((row) => [row.category, row.nominee_id])
  );
  return {
    categories: Object.keys(picks),
    picks,
  };
}
