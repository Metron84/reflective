import { notFound } from "next/navigation";
import CrestSwipe from "@/components/crest/CrestSwipe";
import { CREST_ENABLED } from "@/lib/config";
import { montserrat } from "./montserrat";
import styles from "./page.module.css";

export const metadata = {
  title: "Find Your FC",
  description: "Matched on heart, mind and soul",
  alternates: { canonical: "/crest" },
};

export default async function CrestPage({ searchParams }) {
  if (!CREST_ENABLED) {
    notFound();
  }

  const params = await searchParams;
  const resumeToken = typeof params?.resume === "string" ? params.resume : null;

  return (
    <div className={`${styles.crestPlay} ${montserrat.variable}`} data-crest-play>
      <CrestSwipe resumeToken={resumeToken} />
    </div>
  );
}
