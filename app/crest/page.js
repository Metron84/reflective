import { Montserrat } from "next/font/google";
import { notFound } from "next/navigation";
import CrestSwipe from "@/components/crest/CrestSwipe";
import { CREST_ENABLED } from "@/lib/config";
import styles from "./page.module.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-crest-head",
});

export const metadata = {
  title: "The Crest",
  description:
    "Eighteen swipes. One club. Find the football club that sounds like your heart, thinks like your mind and feels like your soul.",
  alternates: { canonical: "/crest" },
};

export default async function CrestPage({ searchParams }) {
  if (!CREST_ENABLED) {
    notFound();
  }

  const params = await searchParams;
  const resumeToken = typeof params?.resume === "string" ? params.resume : null;

  return (
    <div className={`${styles.crestPlay} ${montserrat.variable}`}>
      <CrestSwipe resumeToken={resumeToken} />
    </div>
  );
}
