import { headers } from "next/headers";
import { redirect } from "next/navigation";
import UltimaJoinForm from "@/components/ultima/UltimaJoinForm";
import styles from "@/components/ultima/ultima.module.css";
import UltimaSeasonFull from "@/components/ultima/UltimaSeasonFull";
import UltimaSeatRetry from "@/components/ultima/UltimaSeatRetry";
import { isUltimaAppHost } from "@/lib/ultima/host";
import { requireSeat } from "@/lib/ultima/server/requireSeat";

export const metadata = {
  title: "Ultima · Join",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaJoinCodePage({ params }) {
  const { code } = await params;
  const normalized = typeof code === "string" ? code.trim().toUpperCase() : "";

  if (!normalized || normalized.length !== 8) {
    redirect("/ultima");
  }

  const appHost = isUltimaAppHost((await headers()).get("host"));
  const joinPath = appHost ? `/join/${normalized}` : `/ultima/join/${normalized}`;

  const seat = await requireSeat(joinPath, { join: true });
  if (seat.status === "unavailable") return <UltimaSeatRetry />;
  if (seat.status === "seated") {
    redirect(seat.manager.profile_complete ? "/ultima" : "/ultima/profile");
  }
  if (seat.status === "full") return <UltimaSeasonFull />;

  const signInHref = `/signin?next=${encodeURIComponent(joinPath)}`;

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>Join</h1>
        <UltimaJoinForm code={normalized} signInHref={signInHref} mode="code" />
      </div>
    </div>
  );
}
