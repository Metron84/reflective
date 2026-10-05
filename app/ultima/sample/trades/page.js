import Link from "next/link";
import { notFound } from "next/navigation";
import UltimaTradesClient from "@/components/ultima/UltimaTradesClient";
import UltimaPanel from "@/components/ultima/UltimaPanel";
import styles from "@/components/ultima/ultima.module.css";
import { sampleTradeOffice } from "@/lib/ultima/sample/trades-preview";

export const metadata = {
  title: "Ultima · SAMPLE trades",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const VIEWS = [
  { id: "board", label: "League block", tab: "block", block: "board", stage: "open" },
  { id: "mine", label: "My block", tab: "block", block: "mine", stage: "open" },
  { id: "sent", label: "Sent offer", tab: "sent", block: "board", stage: "open" },
  { id: "interest", label: "Interest", tab: "block", block: "interest", stage: "open" },
  { id: "early", label: "Before GW4", tab: "block", block: "board", stage: "early" },
  { id: "nosquad", label: "Before draft", tab: "block", block: "board", stage: "nosquad" },
];

export default async function UltimaSampleTradesPage({ searchParams }) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = await searchParams;
  const view = VIEWS.find((v) => v.id === params?.view) ?? VIEWS[0];
  const office = sampleTradeOffice({ stage: view.stage });

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        <div className={styles.utPage}>
          <UltimaPanel title="Views" sample>
            <nav className={styles.utChips} aria-label="SAMPLE views">
              {VIEWS.map((item) => (
                <Link
                  key={item.id}
                  href={`/ultima/sample/trades?view=${item.id}`}
                  className={item.id === view.id ? styles.deskTabOn : styles.deskTab}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </UltimaPanel>
          <UltimaTradesClient
            key={view.id}
            office={office}
            preview
            initialTab={view.tab}
            initialBlockView={view.block}
          />
        </div>
      </div>
    </div>
  );
}
