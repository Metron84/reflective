import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import CrestApp from "@the-crest/components/crest/CrestApp";
import { CREST_ENABLED } from "@/lib/config";
import { montserrat } from "../montserrat";
import styles from "../page.module.css";

export const metadata = {
  title: "Play The Crest",
  description:
    "Find the club that sounds like your heart, thinks like your mind and feels like your soul.",
  alternates: { canonical: "/crest/play" },
};

async function loadClubs() {
  const file = path.join(process.cwd(), "public/crest/clubs.json");
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw);
}

export default async function CrestPlayPage() {
  if (!CREST_ENABLED) {
    notFound();
  }

  const clubs = await loadClubs();

  return (
    <div
      className={`${styles.crestPlay} ${styles.crestPanel} ${montserrat.variable}`}
      data-crest-play
    >
      <CrestApp clubs={clubs} />
    </div>
  );
}
