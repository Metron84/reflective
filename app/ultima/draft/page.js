import Link from "next/link";
import UltimaPhaseShell from "@/components/ultima/UltimaPhaseShell";
import { requireUltimaManager } from "@/lib/ultima/gates";

export const metadata = {
  title: "Ultima · Draft",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaDraftPage() {
  const { manager } = await requireUltimaManager("/ultima/draft");

  return (
    <UltimaPhaseShell
      title="Draft room"
      phase="C"
      lede={
        manager?.profile_complete
          ? "Live snake draft, floor counter, and feed land in Phase C."
          : "Complete your profile before the draft room opens."
      }
    >
      {!manager?.profile_complete ? (
        <p>
          <Link href="/ultima/profile">Complete profile</Link>
        </p>
      ) : null}
    </UltimaPhaseShell>
  );
}
