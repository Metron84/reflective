import UltimaPhaseShell from "@/components/ultima/UltimaPhaseShell";
import { requireUltimaManager } from "@/lib/ultima/gates";

export const metadata = {
  title: "Ultima · Trades",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaTradesPage() {
  await requireUltimaManager("/ultima/trades");

  return (
    <UltimaPhaseShell
      title="Trades"
      phase="I"
      lede="Trade machine with fairness validator and mobile builder ships before gameweek 4."
    />
  );
}
