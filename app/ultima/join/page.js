import { headers } from "next/headers";
import { redirect } from "next/navigation";
import UltimaJoinForm from "@/components/ultima/UltimaJoinForm";
import UltimaStaffMessage from "@/components/ultima/UltimaStaffMessage";
import styles from "@/components/ultima/ultima.module.css";
import { getAuthContext } from "@/lib/auth/session";
import { isUltimaAppHost } from "@/lib/ultima/host";
import { getManagerForUser } from "@/lib/ultima/server/db";
import { isPasswordJoinEnabled } from "@/lib/ultima/server/join";

export const metadata = {
  title: "Ultima · Join",
  description: "Redeem your Ultima invite and join the league.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaJoinPage() {
  const appHost = isUltimaAppHost((await headers()).get("host"));
  const signInHref = appHost ? "/signin?next=/" : "/signin?next=%2Fultima%2Fjoin";

  if (!isPasswordJoinEnabled() && !appHost) {
    redirect("/ultima");
  }

  const auth = await getAuthContext();
  if (!auth.isSignedIn) {
    redirect(signInHref);
  }

  const manager =
    auth.isSignedIn && auth.user ? await getManagerForUser(auth.user.id) : null;
  if (manager) {
    redirect(manager.profile_complete ? "/ultima" : "/ultima/profile");
  }

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>Join</h1>
        <p className={styles.lede}>Invite only. Enter the password from your invite.</p>
        {isPasswordJoinEnabled() ? (
          <UltimaJoinForm signInHref={signInHref} mode="password" />
        ) : (
          <UltimaStaffMessage
            subject="Invite only"
            body="Opens when the commissioner is ready."
          />
        )}
      </div>
    </div>
  );
}
