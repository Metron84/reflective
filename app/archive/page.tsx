import { Suspense } from "react";
import { getAllEntries, getPreviewEntries } from "@/lib/archive/index";
import ArchiveIndex from "@/components/archive/ArchiveIndex";
import styles from "./page.module.css";

export function generateMetadata() {
  const publishedCount = getAllEntries().length;

  return {
    title: "The Beautiful Archive",
    description:
      "Football in books, film, photography, music and art. A curated archive from The Reflective Football.",
    alternates: { canonical: "/archive" },
    // TODO: remove noindex when the first entries publish (entries.json non-empty).
    ...(publishedCount === 0
      ? { robots: { index: false, follow: false } }
      : {}),
  };
}

export default function ArchivePage() {
  const entries = getPreviewEntries();

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1 className={styles.title}>The Beautiful Archive</h1>
          <p className={styles.standfirst}>
            Football in books, film, photography, music and art.
          </p>
        </header>

        {entries.length === 0 ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyHeading}>Nothing published yet</h2>
            <p className={styles.emptyBody}>
              The Beautiful Archive is being verified. Check back soon.
            </p>
          </div>
        ) : (
          <Suspense
            fallback={<p className={styles.loading}>Loading archive…</p>}
          >
            <ArchiveIndex entries={entries} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
