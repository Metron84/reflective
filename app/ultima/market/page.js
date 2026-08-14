import UltimaPhaseShell from "@/components/ultima/UltimaPhaseShell";
import { requireUltimaManager } from "@/lib/ultima/gates";

export const metadata = {
  title: "Ultima · Market",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaMarketPage() {
  await requireUltimaManager("/ultima/market");

  return (
    <UltimaPhaseShell
      title="Market"
      phase="E"
      lede="Free agency add and drop opens after the draft completes."
    />
  );
}
