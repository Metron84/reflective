import Link from "next/link";
import UltimaNewsBoard, { UltimaChat, UltimaTradeDesk } from "./UltimaNewsBoard";
import styles from "./ultima.module.css";

function statusLine(draftState, hubStatus) {
  if (hubStatus?.draft === "live" || draftState === "live") {
    return "The draft is live. Open Draft from the rail.";
  }
  if (draftState === "paused") return "The commissioner paused the draft.";
  if (draftState === "complete") {
    return hubStatus?.standings ?? "Draft complete. Set your XV.";
  }
  return "Waiting for the commissioner to start the draft.";
}

export default function UltimaHub({
  isSignedIn,
  manager,
  draftState = "lobby",
  hubStatus = null,
  news = [],
  tradeCards = [],
}) {
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

      {manager ? (
        <div className={styles.newsCentre}>
          <p className={styles.hubStatus}>{statusLine(draftState, hubStatus)}</p>
          <UltimaTradeDesk initialCards={tradeCards} managerId={manager.id} />
          <div className={styles.newsCentreGrid}>
            <UltimaNewsBoard initialItems={news} />
            <UltimaChat managerId={manager.id} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
