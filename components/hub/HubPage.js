import LiveGameCard from "@/components/games/LiveGameCard";
import SectionHeader from "@/components/SectionHeader";
import SectionContinue from "@/components/SectionContinue";
import Breadcrumb from "@/components/Breadcrumb";
import styles from "@/app/games/page.module.css";

/**
 * Door hub: same card grid as /games. cards: [{ slug, title, hook, href, cover, statusLabel? }]
 */
export default function HubPage({ crumb, eyebrow, title, context, cards, action, next }) {
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
                <LiveGameCard game={card} action={action} />
              </li>
            ))}
          </ul>
        </section>
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
