import Link from "next/link";
import UltimaNewsBoard, { UltimaChat, UltimaTradeDesk } from "./UltimaNewsBoard";
import styles from "./ultima.module.css";

function buildLead({ draftState, hubStatus, tradeCards, news }) {
  if (hubStatus?.draft === "live" || draftState === "live") {
    return {
      kicker: "Live",
      title: "The draft is live",
      body: "The clock is running. Open the draft room from the rail.",
      href: "/ultima/draft",
      cta: "Enter the draft",
      live: true,
    };
  }

  if (draftState === "paused") {
    return {
      kicker: "Paused",
      title: "The commissioner paused the draft",
      body: "The room waits until the clock starts again.",
      href: "/ultima/draft",
      cta: "Open the room",
      live: false,
    };
  }

  const needsVeto = (tradeCards ?? []).find((c) => c.can_veto && !c.already_vetoed);
  if (needsVeto) {
    return {
      kicker: "Veto open",
      title: `${needsVeto.proposer_name} to ${needsVeto.receiver_name}`,
      body: `${needsVeto.giving.join(", ") || "Players"} for ${needsVeto.getting.join(", ") || "players"}. League review.`,
      href: "#ultima-decisions",
      cta: "Review the trade",
      live: true,
    };
  }

  const needsAccept = (tradeCards ?? []).find((c) => c.can_accept);
  if (needsAccept) {
    return {
      kicker: "Proposal",
      title: `${needsAccept.proposer_name} sent you a trade`,
      body: `${needsAccept.giving.join(", ") || "Players"} for ${needsAccept.getting.join(", ") || "players"}.`,
      href: "#ultima-decisions",
      cta: "Accept or decline",
      live: false,
    };
  }

  if (draftState === "complete") {
    return {
      kicker: "Season",
      title: hubStatus?.standings?.includes("You are")
        ? hubStatus.standings
        : "Draft complete. Set your XV.",
      body: "Fifteen score each week. Three from every league.",
      href: "/ultima/squad",
      cta: "My squad",
      live: false,
    };
  }

  const latest = news?.[0];
  if (latest) {
    return {
      kicker: "Latest",
      title: latest.line,
      body: "The league writes here when someone moves.",
      href: "#ultima-news",
      cta: null,
      live: false,
      newsId: latest.id,
    };
  }

  return {
    kicker: "League",
    title: "Waiting for the commissioner to start the draft",
    body: "Ten seats. Practice does not count.",
    href: "/ultima/practice",
    cta: "Open practice",
    live: false,
  };
}

export default function UltimaHub({
  isSignedIn,
  manager,
  draftState = "lobby",
  hubStatus = null,
  news = [],
  tradeCards = [],
}) {
  const lead = manager
    ? buildLead({ draftState, hubStatus, tradeCards, news })
    : null;
  const columnNews = lead?.newsId
    ? news.filter((item) => item.id !== lead.newsId)
    : news;

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

      {manager && lead ? (
        <div className={styles.newsCentre}>
          <article className={lead.live ? styles.leadLive : styles.lead}>
            <p className={styles.leadKicker}>{lead.kicker}</p>
            <h2 className={styles.leadTitle}>{lead.title}</h2>
            <p className={styles.leadBody}>{lead.body}</p>
            {lead.cta && lead.href ? (
              <Link href={lead.href} className={styles.primaryBtn}>
                {lead.cta}
              </Link>
            ) : null}
          </article>

          <div className={styles.newsCentreGrid}>
            <div className={styles.storiesColumn}>
              <UltimaTradeDesk initialCards={tradeCards} managerId={manager.id} />
              <UltimaNewsBoard initialItems={columnNews} />
            </div>
            <UltimaChat managerId={manager.id} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
