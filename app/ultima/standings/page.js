import UltimaPhaseShell from "@/components/ultima/UltimaPhaseShell";
import { requireUltimaManager } from "@/lib/ultima/gates";

export const metadata = {
  title: "Ultima · Standings",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaStandingsPage() {
  await requireUltimaManager("/ultima/standings");

  return (
    <UltimaPhaseShell
      title="Standings"
      phase="D"
      lede="Season table, Bolt board, and bot risk numbers."
    />
  );
}
