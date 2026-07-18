import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { getProgrammeData } from "@/lib/account/programme";
import ProgrammeHeader from "@/components/account/ProgrammeHeader";
import ProgrammeTodayLine from "@/components/account/ProgrammeTodayLine";
import GuesserSection from "@/components/account/GuesserSection";
import ReflectionsBallot from "@/components/account/ReflectionsBallot";
import HonoursSection from "@/components/account/HonoursSection";
import SettingsPanel from "@/components/account/SettingsPanel";
import styles from "./page.module.css";

export const metadata = {
  title: "My Programme",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const auth = await getAuthContext();
  if (!auth.isSignedIn) {
    redirect("/signin?next=/account");
  }
  if (!auth.profile?.welcome_completed) {
    redirect("/welcome?next=/account");
  }

  const programme = await getProgrammeData(auth.user, auth.profile);

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>My Programme</p>
        <ProgrammeHeader profile={programme.profile} />
        <ProgrammeTodayLine todayLine={programme.todayLine} />
        <GuesserSection
          modeStats={programme.modeStats}
          shareStats={programme.shareStats}
        />
        <ReflectionsBallot ballot={programme.ballot} />
        <HonoursSection honours={programme.honours} />
        <SettingsPanel
          key={`${programme.profile.preferredName}|${(programme.profile.clubs ?? []).join(",")}|${programme.profile.marketingConsent}`}
          initialName={programme.profile.preferredName}
          initialClubs={programme.profile.clubs}
          initialMarketing={programme.profile.marketingConsent}
          email={programme.email}
          clubOptions={programme.clubOptions}
        />
      </div>
    </div>
  );
}
