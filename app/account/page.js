import { redirect } from "next/navigation";
import { profileIsAdmin } from "@/lib/auth/admin";
import { getAuthContext } from "@/lib/auth/session";
import { getProgrammeData } from "@/lib/account/programme";
import ProgrammePitch from "@/components/account/ProgrammePitch";
import ProgrammeHeader from "@/components/account/ProgrammeHeader";
import RevealsProvider from "@/components/account/RevealsProvider";
import NextUp from "@/components/account/NextUp";
import GamesSection from "@/components/account/GamesSection";
import CrestTile from "@/components/account/CrestTile";
import HonoursSection from "@/components/account/HonoursSection";
import AdminBlock from "@/components/account/AdminBlock";
import ArchiveSection from "@/components/account/ArchiveSection";
import SettingsPanel from "@/components/account/SettingsPanel";
import Breadcrumb from "@/components/Breadcrumb";
import styles from "./page.module.css";

export const metadata = {
  title: "My Programme",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const auth = await getAuthContext();
  if (!auth.isSignedIn) {
    // Signed out: say what the Programme holds, with one way in.
    return (
      <div className={styles.page}>
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "My Programme" }]} />
        <div className={styles.inner}>
          <p className={styles.eyebrow}>My Programme</p>
          <ProgrammePitch />
        </div>
      </div>
    );
  }
  if (!auth.profile?.welcome_completed) {
    redirect("/welcome?next=/account");
  }

  const programme = await getProgrammeData(auth.user, auth.profile);

  return (
    <div className={styles.page}>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "My Programme" }]} />
      <div className={styles.inner}>
        <p className={styles.eyebrow}>My Programme</p>
        <ProgrammeHeader
          profile={programme.profile}
          crestClub={programme.crest?.clubName ?? null}
        />

        <RevealsProvider
          key={`${programme.crestLeagues?.savedAt ?? "none"}|${programme.revealed.join(",")}`}
          initial={programme.revealed}
        >
          <NextUp
            quizOpen={programme.games.quiz.openToday}
            codemasterInProgress={programme.games.codemaster.inProgress}
            competitions={(programme.crestLeagues?.leagues ?? []).map((l) => l.competition)}
          />
          <GamesSection
            games={programme.games}
            crestTile={<CrestTile crest={programme.crest} leagues={programme.crestLeagues} />}
          />
        </RevealsProvider>
        <HonoursSection honours={programme.honours} />
        <ArchiveSection ballot={programme.ballot} />
        <SettingsPanel
          key={`${programme.profile.preferredName}|${(programme.profile.clubs ?? []).join(",")}|${programme.profile.marketingConsent}`}
          initialName={programme.profile.preferredName}
          initialClubs={programme.profile.clubs}
          initialMarketing={programme.profile.marketingConsent}
          email={programme.email}
          clubOptions={programme.clubOptions}
        />
        {profileIsAdmin(auth.profile) ? <AdminBlock /> : null}
      </div>
    </div>
  );
}
