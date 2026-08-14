import UltimaPhaseShell from "@/components/ultima/UltimaPhaseShell";
import { requireUltimaManager } from "@/lib/ultima/gates";

export const metadata = {
  title: "Ultima · Log",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaLogPage() {
  await requireUltimaManager("/ultima/log");

  return (
    <UltimaPhaseShell
      title="Commissioner log"
      phase="J"
      lede="Public append-only audit trail for commissioner actions."
    />
  );
}
