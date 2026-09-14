import { readFileSync } from "fs";
import { join } from "path";
import { notFound } from "next/navigation";
import CrestApp from "@the-crest/components/crest/CrestApp";
import { CREST_ENABLED } from "@/lib/config";
import styles from "./page.module.css";

export const metadata = {
  title: "The Crest",
  description:
    "Find the football club that sounds like your heart, thinks like your mind and feels like your soul.",
  alternates: { canonical: "/crest" },
};

function loadClubs() {
  const path = join(process.cwd(), "public/crest/clubs.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

export default function CrestPage() {
  if (!CREST_ENABLED) {
    notFound();
  }

  const clubs = loadClubs();

  return (
    <div className={styles.crestPlay}>
      <div className={styles.crestMain}>
        <CrestApp clubs={clubs} />
      </div>
    </div>
  );
}
