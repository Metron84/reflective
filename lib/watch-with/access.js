import "server-only";
import { getServiceClient } from "@/lib/supabase";
import { getClub, listClubs } from "./clubs";

export function previewMatches(value) {
  const key = process.env.WATCHWITH_PREVIEW_KEY || "";
  return Boolean(key) && typeof value === "string" && value.length > 0 && value === key;
}

export function previewFrom(request, body) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("preview");
    if (typeof query === "string" && query) return query;
  } catch {
    // The request URL is only used for the preview query.
  }
  return typeof body?.preview === "string" ? body.preview : "";
}

function presentation(seed, row) {
  const fanLabel = row?.fan_label || seed.fanLabel;
  return {
    slug: seed.slug,
    name: row?.name || seed.name,
    shortName: row?.short_name || seed.shortName || seed.name,
    fanLabel,
    primaryColor: row?.primary_color || seed.primaryColor,
    accentColor: row?.accent_color || seed.accentColor,
    sortOrder: row?.sort_order ?? seed.sortOrder ?? 99,
    active: row ? Boolean(row.active) : seed.slug === "west-ham",
    headline: seed.headline,
    subline: `Pick your matchday companion. The ${fanLabel} decide the ranking.`,
    deckSize: seed.deckSize,
    cards: seed.cards,
  };
}

async function loadClubRows() {
  const client = getServiceClient();
  if (!client) return [];
  const { data, error } = await client.from("watch_with_clubs").select("*").order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function presentClub(slug) {
  const seed = getClub(slug);
  if (!seed) return null;
  let row = null;
  try {
    const rows = await loadClubRows();
    row = rows.find((item) => item.slug === slug) ?? null;
  } catch (error) {
    console.error("watch-with/club", error);
  }
  return presentation(seed, row);
}

export async function playableClub(request, slug, body) {
  const club = await presentClub(slug);
  if (!club) return null;
  if (club.active || previewMatches(previewFrom(request, body))) return club;
  return null;
}

export async function pickerClubs() {
  const seeds = listClubs();
  let rows = [];
  const counts = new Map();
  try {
    rows = await loadClubRows();
    const client = getServiceClient();
    if (client) {
      const { data, error } = await client
        .from("watch_with_runs")
        .select("club_slug")
        .not("completed_at", "is", null);
      if (error) throw error;
      for (const run of data ?? []) {
        counts.set(run.club_slug, (counts.get(run.club_slug) ?? 0) + 1);
      }
    }
  } catch (error) {
    console.error("watch-with/picker", error);
  }
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  return seeds
    .map((seed) => ({
      ...presentation(seed, bySlug.get(seed.slug) ?? null),
      completedRuns: counts.get(seed.slug) ?? 0,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
