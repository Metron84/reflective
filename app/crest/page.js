import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CREST_ENABLED, CREST_PLAY_URL } from "@/lib/config";
import { montserrat } from "./montserrat";
import styles from "./page.module.css";

export const metadata = {
  title: "The Crest",
  description:
    "Find the club that sounds like your heart, thinks like your mind and feels like your soul.",
  alternates: { canonical: "/crest" },
};

export default async function CrestLandingPage({ searchParams }) {
  if (!CREST_ENABLED) {
    notFound();
  }

  const params = await searchParams;
  if (typeof params?.resume === "string" && params.resume) {
    redirect(`/crest/swipe?resume=${encodeURIComponent(params.resume)}`);
  }

  return (
    <div
      className={`${styles.crestLanding} ${montserrat.variable}`}
      data-crest-landing
    >
      <main className={styles.landingMain}>
        <p className={styles.brand}>The Crest</p>
        <h1 className={styles.headline}>
          Find the club that sounds like your heart, thinks like your mind and
          feels like your soul.
        </h1>
        <p className={styles.support}>
          Twelve questions. One crest. A club to know, never a club to leave.
        </p>
        <div className={styles.ctaRow}>
          <Link href={CREST_PLAY_URL} className={styles.cta}>
            Play The Crest
          </Link>
          <Link href="/crest/swipe" className={styles.secondary}>
            Find Your FC (swipe)
          </Link>
        </div>
      </main>
    </div>
  );
}
