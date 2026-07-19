import { requireAdminPage } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import TaggingAdmin from "./TaggingAdmin";

export const dynamic = "force-dynamic";

export default async function TaggingAdminPage() {
  await requireAdminPage();
  const supabase = await createClient();

  let venues = [];
  let fanGroups = [];
  let videos = [];

  if (supabase) {
    const [v, f, vid] = await Promise.all([
      supabase.from("venues").select("*").order("name"),
      supabase.from("fan_groups").select("*").order("name"),
      supabase
        .from("videos")
        .select("*, venues(id, name), video_fan_groups(fan_group_id)")
        .order("published_at", { ascending: false, nullsFirst: false }),
    ]);
    venues = v.data ?? [];
    fanGroups = f.data ?? [];
    videos = (vid.data ?? []).map((row) => ({
      ...row,
      venue: row.venues ?? null,
      fan_group_ids: (row.video_fan_groups ?? []).map((j) => j.fan_group_id),
      venues: undefined,
      video_fan_groups: undefined,
    }));
  }

  return (
    <TaggingAdmin
      initialVenues={venues}
      initialFanGroups={fanGroups}
      initialVideos={videos}
    />
  );
}
