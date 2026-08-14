import Link from "next/link";
import UltimaDoor from "./UltimaDoor";
import styles from "./ultima.module.css";

const STATIC_DOORS = [
  { href: "/ultima/rules", label: "Rules", status: "Scoring, floors and locks." },
  { href: "/films", label: "Films", status: "From the fans, every day." },
  { href: "/games", label: "Games", status: "The Guesser, Codemaster, and more." },
];

export default function UltimaHub({
  isSignedIn,
  manager,
  draftState = "lobby",
}) {
  const managerDoors = manager
    ? [
        {
          href: "/ultima/draft",
          label: "Draft room",
          status:
            draftState === "complete"
              ? "Complete"
              : draftState === "live"
                ? "Live"
                : "Opens when the commissioner starts the draft",
        },
        {
          href: "/ultima/squad",
          label: "My squad",
          status: manager.profile_complete
            ? "Set your XI before the first kickoff"
            : "Complete your profile first",
        },
        { href: "/ultima/market", label: "Market", status: "Free agents after the draft" },
        {
          href: "/ultima/trades",
          label: "Trades",
          status: "Trades open at gameweek 4",
        },
        { href: "/ultima/standings", label: "Standings", status: "Season table and Bolt board" },
        { href: "/ultima/log", label: "Commissioner log", status: "Public audit trail" },
      ]
    : [];

  return (
    <div className={styles.hub}>
      {!isSignedIn ? (
        <p className={styles.hubNote}>
          Sign in to redeem an invite.{" "}
          <Link href="/signin?next=/ultima" className={styles.quietLink}>
            Sign in
          </Link>
        </p>
      ) : null}

      {!manager && isSignedIn ? (
        <p className={styles.hubNote}>
          Open the invite link from the commissioner to join. While you wait, watch the films or play Codemaster.
        </p>
      ) : null}

      {managerDoors.length > 0 ? (
        <nav className={styles.doorList} aria-label="Ultima hub">
          {managerDoors.map((door) => (
            <UltimaDoor key={door.href} {...door} />
          ))}
        </nav>
      ) : null}

      <nav className={styles.doorList} aria-label="Ultima and site">
        {STATIC_DOORS.map((door) => (
          <UltimaDoor key={door.href} {...door} />
        ))}
      </nav>
    </div>
  );
}
