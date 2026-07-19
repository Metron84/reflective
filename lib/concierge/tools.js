import { getServiceClient } from "@/lib/supabase";

/**
 * Neutral tool definitions (JSON Schema parameters).
 * Providers map these into their native function-calling format.
 */
export const CONCIERGE_TOOLS = [
  {
    name: "search_videos",
    description:
      "Search tagged TRF videos by venue, atmosphere, vibe, fixture type, competition, or fan group. Returns up to 8 matches with moments.",
    parameters: {
      type: "object",
      properties: {
        venue_name: {
          type: "string",
          description: "Partial venue name match, e.g. Nelson or McGettigan",
        },
        min_atmosphere: {
          type: "integer",
          description: "Minimum atmosphere_index 1-10",
        },
        vibe_tags: {
          type: "array",
          items: { type: "string" },
          description: "Videos must include at least one of these vibe tags",
        },
        fixture_type: {
          type: "string",
          description:
            "group_stage | knockout | final | derby | league | friendly | other",
        },
        competition: {
          type: "string",
          description: "Partial competition match, e.g. World Cup 2026",
        },
        fan_group: {
          type: "string",
          description: "Partial fan group name, e.g. Arsenal Dubai",
        },
        setting: {
          type: "string",
          description:
            "Venue setting: outdoor | indoor | rooftop | covered | mixed",
        },
      },
    },
  },
  {
    name: "search_venues",
    description:
      "Search venues by setting, group size, outdoor seating, or vibe seen in their tagged videos.",
    parameters: {
      type: "object",
      properties: {
        setting: {
          type: "string",
          description: "outdoor | indoor | rooftop | covered | mixed",
        },
        min_group_size: {
          type: "integer",
          description:
            "Venue typical_group_max must be >= this (comfortable for a group of this size)",
        },
        outdoor_seating: {
          type: "boolean",
          description: "Require outdoor seating true/false",
        },
        vibe: {
          type: "string",
          description:
            "Match venues that have videos tagged with this vibe (e.g. high-energy)",
        },
      },
    },
  },
  {
    name: "handoff_to_melo",
    description:
      "Call when the user needs a human (partnerships, pitches, personal stories, working with TRF). Do not search the archive.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Short reason for the handoff",
        },
      },
    },
  },
];

function shapeVideo(row, momentsByVideo) {
  return {
    type: "video",
    id: row.id,
    youtube_id: row.youtube_id,
    title: row.title,
    fixture: row.fixture,
    fixture_date: row.fixture_date,
    competition: row.competition,
    atmosphere_index: row.atmosphere_index,
    vibe_tags: row.vibe_tags ?? [],
    venue: row.venues?.name ?? null,
    venue_id: row.venue_id,
    moments: (momentsByVideo.get(row.id) ?? []).map((m) => ({
      label: m.label,
      timestamp_seconds: m.timestamp_seconds,
      moment_type: m.moment_type,
    })),
  };
}

export async function executeSearchVideos(input = {}) {
  const supabase = getServiceClient();
  if (!supabase) {
    return { error: "Database not configured.", results: [] };
  }

  // Inner-join venues only when filtering by venue fields (null venue_id rows drop out).
  const needsVenue = Boolean(input.venue_name) || Boolean(input.setting);
  const venueSelect = needsVenue
    ? "venues!inner ( id, name, setting )"
    : "venues ( id, name, setting )";

  let query = supabase.from("videos").select(
    `
      id,
      youtube_id,
      title,
      fixture,
      fixture_date,
      competition,
      atmosphere_index,
      vibe_tags,
      venue_id,
      fixture_type,
      ${venueSelect}
    `
  );

  if (input.min_atmosphere != null) {
    query = query.gte("atmosphere_index", Number(input.min_atmosphere));
  }
  if (input.fixture_type) {
    query = query.eq("fixture_type", String(input.fixture_type));
  }
  if (input.competition) {
    query = query.ilike("competition", `%${String(input.competition).trim()}%`);
  }
  if (Array.isArray(input.vibe_tags) && input.vibe_tags.length) {
    query = query.overlaps("vibe_tags", input.vibe_tags.map(String));
  }
  if (input.venue_name) {
    query = query.ilike("venues.name", `%${String(input.venue_name).trim()}%`);
  }
  if (input.setting) {
    query = query.eq("venues.setting", String(input.setting));
  }

  let fanGroupVideoIds = null;
  if (input.fan_group) {
    const { data: groups } = await supabase
      .from("fan_groups")
      .select("id")
      .ilike("name", `%${String(input.fan_group).trim()}%`);
    const gids = (groups ?? []).map((g) => g.id);
    if (!gids.length) {
      return { results: [], note: "No matching fan groups." };
    }
    const { data: joins } = await supabase
      .from("video_fan_groups")
      .select("video_id")
      .in("fan_group_id", gids);
    fanGroupVideoIds = [...new Set((joins ?? []).map((j) => j.video_id))];
    if (!fanGroupVideoIds.length) {
      return { results: [], note: "No videos for that fan group." };
    }
    query = query.in("id", fanGroupVideoIds);
  }

  const { data: videos, error } = await query
    .order("atmosphere_index", { ascending: false, nullsFirst: false })
    .limit(8);

  if (error) {
    return { error: error.message, results: [] };
  }

  const ids = (videos ?? []).map((v) => v.id);
  const momentsByVideo = new Map();
  if (ids.length) {
    const { data: moments } = await supabase
      .from("video_moments")
      .select("video_id, label, timestamp_seconds, moment_type")
      .in("video_id", ids)
      .order("timestamp_seconds");
    for (const m of moments ?? []) {
      const list = momentsByVideo.get(m.video_id) ?? [];
      list.push(m);
      momentsByVideo.set(m.video_id, list);
    }
  }

  const results = (videos ?? []).map((v) => shapeVideo(v, momentsByVideo));
  return { results };
}

export async function executeSearchVenues(input = {}) {
  const supabase = getServiceClient();
  if (!supabase) {
    return { error: "Database not configured.", results: [] };
  }

  let query = supabase.from("venues").select("*");

  if (input.setting) {
    query = query.eq("setting", String(input.setting));
  }
  if (input.outdoor_seating != null) {
    query = query.eq("outdoor_seating", Boolean(input.outdoor_seating));
  }
  if (input.min_group_size != null) {
    query = query.gte("typical_group_max", Number(input.min_group_size));
  }

  let vibeVenueIds = null;
  if (input.vibe) {
    const tag = String(input.vibe).trim();
    const { data: vids } = await supabase
      .from("videos")
      .select("venue_id")
      .not("venue_id", "is", null)
      .contains("vibe_tags", [tag]);
    vibeVenueIds = [
      ...new Set((vids ?? []).map((v) => v.venue_id).filter(Boolean)),
    ];
    if (!vibeVenueIds.length) {
      return { results: [], note: "No venues with videos tagged that vibe." };
    }
    query = query.in("id", vibeVenueIds);
  }

  const { data: venues, error } = await query.order("name").limit(12);
  if (error) {
    return { error: error.message, results: [] };
  }

  const ids = (venues ?? []).map((v) => v.id);
  const stats = new Map();
  if (ids.length) {
    const { data: vids } = await supabase
      .from("videos")
      .select("venue_id, atmosphere_index")
      .in("venue_id", ids);
    for (const v of vids ?? []) {
      const cur = stats.get(v.venue_id) ?? {
        video_count: 0,
        top_atmosphere_index: null,
      };
      cur.video_count += 1;
      if (
        v.atmosphere_index != null &&
        (cur.top_atmosphere_index == null ||
          v.atmosphere_index > cur.top_atmosphere_index)
      ) {
        cur.top_atmosphere_index = v.atmosphere_index;
      }
      stats.set(v.venue_id, cur);
    }
  }

  const results = (venues ?? []).map((v) => {
    const s = stats.get(v.id) ?? {
      video_count: 0,
      top_atmosphere_index: null,
    };
    return {
      type: "venue",
      id: v.id,
      name: v.name,
      area: v.area,
      city: v.city,
      setting: v.setting,
      capacity_vibe: v.capacity_vibe,
      outdoor_seating: v.outdoor_seating,
      typical_group_max: v.typical_group_max,
      food_drink_notes: v.food_drink_notes,
      notes: v.notes,
      video_count: s.video_count,
      top_atmosphere_index: s.top_atmosphere_index,
    };
  });

  return { results };
}

export async function runTool(name, input) {
  if (name === "search_videos") {
    return executeSearchVideos(input ?? {});
  }
  if (name === "search_venues") {
    return executeSearchVenues(input ?? {});
  }
  if (name === "handoff_to_melo") {
    return {
      handoff: true,
      reason: input?.reason ?? "Relationship / partnership inquiry",
    };
  }
  return { error: `Unknown tool: ${name}` };
}
