import Link from "next/link";
import UltimaDoor from "./UltimaDoor";
import styles from "./ultima.module.css";

const STATIC_DOORS = [
  { href: "/ultima/rules", label: "Rules", status: "Scoring, floors and locks." },
  { href: "/films", label: "Films", status: "From the fans, every day." },
  { href: "/games", label: "Games", status: "The Guesser, Codemaster, and more." },
];

function draftStatusLine(draftState, hubStatus) {
  if (hubStatus?.draft === "live") return "Live. Check the draft room.";
  if (draftState === "complete") return "Complete";
  if (draftState === "paused") return "Paused by the commissioner";
  if (draftState === "live") return "Live";
  return "Opens when the commissioner starts the draft";
}

export default function UltimaHub({
  isSignedIn,
  manager,
  draftState = "lobby",
  hubStatus = null,
}) {
  const managerDoors = manager
    ? [
        {
          href: "/ultima/draft",
          label: "Draft room",
          status: draftStatusLine(draftState, hubStatus),
        },
        {
          href: "/ultima/squad",
          label: "My squad",
          status: manager.profile_complete
            ? hubStatus?.standings?.includes("You are")
              ? hubStatus.standings
              : "Set your XI before the first kickoff"
            : "Complete your profile first",
        },
        {
          href: "/ultima/market",
          label: "Market",
          status: hubStatus?.market ?? "Free agents after the draft",
        },
        {
          href: "/ultima/trades",
          label: "Trades",
          status: hubStatus?.trades ?? "Trades open at gameweek 4",
        },
        {
          href: "/ultima/standings",
          label: "Standings",
          status: hubStatus?.standings ?? "Season table and Bolt board",
        },
        { href: "/ultima/log", label: "Commissioner log", status: "Public audit trail" },
      ]
    : [];

  return (
    <div className={styles.hub}>
      {!isSignedIn ? (
        <p className={styles.hubNote}>
          Invite only.{" "}
          <Link href="/signin?next=/ultima/join" className={styles.quietLink}>
            Sign in to join
          </Link>
        </p>
      ) : null}

      {!manager && isSignedIn ? (
        <p className={styles.hubNote}>
          <Link href="/ultima/join" className={styles.quietLink}>
            Enter your invite password
          </Link>
          {" · "}
          <Link href="/ultima/rules" className={styles.quietLink}>
            Read the rules
          </Link>
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
