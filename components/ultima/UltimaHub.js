import Link from "next/link";
import UltimaDoor from "./UltimaDoor";
import UltimaNewsBoard, { UltimaChat } from "./UltimaNewsBoard";
import styles from "./ultima.module.css";

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
  isCommissioner = false,
  news = [],
}) {
  const managerDoors = manager
    ? [
        {
          href: "/ultima/draft",
          label: "Draft room",
          status: draftStatusLine(draftState, hubStatus),
        },
        {
          href: "/ultima/practice",
          label: "Practice draft",
          status: "Save a board. Resume by code.",
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

      {manager ? (
        <>
          <UltimaNewsBoard initialItems={news} />
          <UltimaChat managerId={manager.id} />
        </>
      ) : null}

      <nav className={styles.doorList} aria-label="Ultima extras">
        {isCommissioner ? (
          <UltimaDoor
            href="/ultima/admin"
            label="Commissioner"
            status="Sync players, schedule and start the draft."
          />
        ) : null}
        <UltimaDoor href="/ultima/rules" label="Rules" status="Scoring, floors and locks." />
      </nav>
    </div>
  );
}
