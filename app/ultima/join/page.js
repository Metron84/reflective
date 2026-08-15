import { redirect } from "next/navigation";
import UltimaJoinForm from "@/components/ultima/UltimaJoinForm";
import styles from "@/components/ultima/ultima.module.css";
import { getAuthContext } from "@/lib/auth/session";
import { getManagerForUser } from "@/lib/ultima/server/db";
import { isPasswordJoinEnabled } from "@/lib/ultima/server/join";

export const metadata = {
  title: "Ultima · Join",
  description: "Redeem your Ultima invite and join the league.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaJoinPage() {
  if (!isPasswordJoinEnabled()) {
    redirect("/ultima");
  }

  const auth = await getAuthContext();
  if (!auth.isSignedIn) {
    redirect("/signin?next=%2Fultima%2Fjoin");
  }

  const manager = await getManagerForUser(auth.user.id);
  if (manager) {
    redirect(manager.profile_complete ? "/ultima" : "/ultima/profile");
  }

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>Join</h1>
        <p className={styles.lede}>Invite only. Enter the password from your invite.</p>
        <UltimaJoinForm signInHref="/signin?next=%2Fultima%2Fjoin" mode="password" />
      </div>
    </div>
  );
}
