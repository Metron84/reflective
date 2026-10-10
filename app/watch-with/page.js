import { headers } from "next/headers";
import ClubPicker from "@/components/watch-with/ClubPicker";
import { SITE_URL } from "@/lib/config";
import { pickerClubs } from "@/lib/watch-with/access";
import { watchWithPaths } from "@/lib/watch-with/host";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Who would you rather watch the match with? | The Reflective Football",
  description: "Dream matchday. Any era. You choose who sits next to you.",
  alternates: { canonical: `${SITE_URL}/watch-with` },
};

export default async function WatchWithHub() {
  const clubs = await pickerClubs();
  const hdrs = await headers();
  const host = hdrs.get("host");
  return (
    <ClubPicker
      clubs={clubs.map((club) => ({
        slug: club.slug,
        name: club.name,
        fanLabel: club.fanLabel,
        primaryColor: club.primaryColor,
        active: club.active,
        completedRuns: club.completedRuns,
      }))}
      pathsFor={(slug) => watchWithPaths(host, slug)}
    />
  );
}
