import UltimaPhaseShell from "@/components/ultima/UltimaPhaseShell";
import { requireUltimaManager } from "@/lib/ultima/gates";

export const metadata = {
  title: "Ultima · Squad",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaSquadPage() {
  await requireUltimaManager("/ultima/squad");

  return (
    <UltimaPhaseShell
      title="My squad"
      phase="D"
      lede="XI and Squad tabs, per-league locks, and live scoring land in Phase D."
    />
  );
}
