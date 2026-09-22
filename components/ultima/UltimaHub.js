import Link from "next/link";
import UltimaNewsBoard, { UltimaChat, UltimaTradeDesk } from "./UltimaNewsBoard";
import UltimaInstallHint from "./UltimaInstallHint";
import UltimaEuropeDesk from "./UltimaEuropeDesk";
import styles from "./ultima.module.css";

function buildLead({ draftState, hubStatus, tradeCards, news }) {
  if (hubStatus?.draft === "live" || draftState === "live") {
    return {
      kicker: "Live",
      title: "The draft is live",
      body: "The clock is running for you. Bots pick at once.",
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
    body: "Ten seats. Pre-draft does not count.",
    href: "/ultima/practice",
    cta: "Open pre-draft",
    live: false,
  };
}

function buildBriefing({ draftState, hubStatus, tradeCards, europeDesk }) {
  const items = [];

  if (hubStatus?.draft === "live" || draftState === "live") {
    items.push({
      text: "The draft is live. The clock is running.",
      href: "/ultima/draft",
      cta: "Enter the draft",
    });
  }

  const veto = (tradeCards ?? []).find((c) => c.can_veto && !c.already_vetoed);
  if (veto) {
    items.push({
      text: `${veto.proposer_name} to ${veto.receiver_name} is in league review.`,
      href: "#ultima-decisions",
      cta: "Review",
    });
  }

  const accept = (tradeCards ?? []).find((c) => c.can_accept);
  if (accept) {
    items.push({
      text: `${accept.proposer_name} sent you a trade.`,
      href: "#ultima-decisions",
      cta: "Open",
    });
  }

  if (draftState === "complete" && hubStatus?.standings) {
    items.push({
      text: hubStatus.standings,
      href: "/ultima/squad",
      cta: "My squad",
    });
  }

  if (draftState === "complete" && hubStatus?.market) {
    items.push({
      text: hubStatus.market,
      href: "/ultima/market",
      cta: "Market",
    });
  }

  const rising = europeDesk?.movers?.rising?.length ?? 0;
  const falling = europeDesk?.movers?.falling?.length ?? 0;
  if (rising || falling) {
    items.push({
      text: `${rising} rising · ${falling} falling in the last ratings.`,
      href: "#ultima-form",
      cta: "Form",
    });
  }

  return items.slice(0, 3);
}

export default function UltimaHub({
  isSignedIn,
  manager,
  draftState = "lobby",
  hubStatus = null,
  news = [],
  tradeCards = [],
  europeDesk = null,
}) {
  const lead = manager
    ? buildLead({ draftState, hubStatus, tradeCards, news })
    : null;
  const columnNews = lead?.newsId
    ? news.filter((item) => item.id !== lead.newsId)
    : news;

  const doors = manager ? (
    <div className={styles.hubDoors}>
      <Link href="/ultima/draft" className={styles.hubDoor}>
        <span className={styles.hubDoorKicker}>Season</span>
        <strong>Draft</strong>
      </Link>
      <Link href="/ultima/practice" className={styles.hubDoor}>
        <span className={styles.hubDoorKicker}>Does not count</span>
        <strong>Pre-draft</strong>
      </Link>
    </div>
  ) : null;

  const briefing = manager
    ? buildBriefing({ draftState, hubStatus, tradeCards, europeDesk })
    : [];

  const leadNode =
    manager && lead ? (
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
    ) : null;

  const briefingNode =
    manager && briefing.length ? (
      <section className={styles.officePanel} aria-label="Manager briefing">
        <h2 className={styles.panelTitle}>Your briefing</h2>
        <ul className={styles.briefingList}>
          {briefing.map((item) => (
            <li key={item.text} className={styles.briefingItem}>
              <p className={styles.briefingText}>{item.text}</p>
              <Link href={item.href} className={styles.quietLink}>
                {item.cta}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    ) : null;

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
        <UltimaEuropeDesk
          desk={europeDesk}
          doors={doors}
          lead={leadNode}
          briefing={briefingNode}
          inboxExtra={
            <>
              <UltimaTradeDesk initialCards={tradeCards} managerId={manager.id} />
              <UltimaNewsBoard initialItems={columnNews} />
            </>
          }
          radio={<UltimaChat managerId={manager.id} />}
        />
      ) : null}

      {manager ? <UltimaInstallHint /> : null}
    </div>
  );
}
