import { redirect } from "next/navigation";
import UltimaJoinForm from "@/components/ultima/UltimaJoinForm";
import styles from "@/components/ultima/ultima.module.css";
import { getAuthContext } from "@/lib/auth/session";
import { getManagerForUser } from "@/lib/ultima/server/db";

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

  const auth = await getAuthContext();
  if (!auth.isSignedIn) {
    redirect(`/signin?next=${encodeURIComponent(`/ultima/join/${normalized}`)}`);
  }

  const manager = await getManagerForUser(auth.user.id);
  if (manager) {
    redirect(manager.profile_complete ? "/ultima" : "/ultima/profile");
  }

  const signInHref = `/signin?next=${encodeURIComponent(`/ultima/join/${normalized}`)}`;

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>Join</h1>
        <UltimaJoinForm code={normalized} signInHref={signInHref} />
      </div>
    </div>
  );
}
