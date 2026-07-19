import SectionHeader from "@/components/SectionHeader";
import SectionContinue from "@/components/SectionContinue";
import ConciergeChat from "@/components/concierge/ConciergeChat";
import styles from "./page.module.css";

export const metadata = {
  title: "The Concierge",
  description:
    "Ask about venues, atmospheres, and the best fan moments we've filmed.",
};

export default function ConciergePage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <SectionHeader
          className={styles.header}
          eyebrow="Guide"
          title="The Concierge"
          context="Ask about venues, atmospheres, and the best fan moments we've filmed."
        />
        <ConciergeChat />
        <div className={styles.continue}>
          <SectionContinue
            nextHref="/films"
            nextEyebrow="Films"
            nextTitle="Watch the archive"
          />
        </div>
      </div>
    </main>
  );
}
