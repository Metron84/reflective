import LiveGameCard from "@/components/games/LiveGameCard";
import SectionHeader from "@/components/SectionHeader";
import SectionContinue from "@/components/SectionContinue";
import Breadcrumb from "@/components/Breadcrumb";
import styles from "@/app/games/page.module.css";

/**
 * Shared hub template for /games, /competitions, /events and /observatory.
 * cards: [{ slug, title, hook, href, cover, coverFocus?, statusLabel?, action?, strapline? }]
 * children render below the card grid (for example "More games coming").
 */
export default function HubPage({
  crumb,
  eyebrow,
  title,
  context,
  cards,
  action,
  wide = false,
  next,
  children,
}) {
  return (
    <div className={styles.page}>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: crumb }]} />
      <div className={styles.inner}>
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          context={context}
          className={styles.sectionHeader}
        />
        <section className={styles.heroSection} aria-label={title}>
          <ul className={styles.comingGrid}>
            {cards.map((card) => (
              <li key={card.slug}>
                <LiveGameCard
                  game={card}
                  strapline={card.strapline}
                  action={action}
                  wide={wide}
                />
              </li>
            ))}
          </ul>
        </section>
        {children}
        {next ? (
          <SectionContinue
            nextHref={next.href}
            nextEyebrow={next.eyebrow}
            nextTitle={next.title}
          />
        ) : null}
      </div>
    </div>
  );
}
