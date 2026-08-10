import { Suspense } from "react";
import { getPreviewEntries } from "@/lib/archive/index";
import { buildSearchIndex } from "@/lib/archive/search";
import ArchiveIndex from "@/components/archive/ArchiveIndex";
import ArchiveOfflineNotice from "@/components/archive/ArchiveOfflineNotice";
import styles from "./page.module.css";

export function generateMetadata() {
  return {
    title: "The Beautiful Archive",
    description:
      "Football in books, film, photography, music and art. A curated archive from The Reflective Football.",
    alternates: { canonical: "/archive" },
  };
}

export default async function ArchivePage({ searchParams }) {
  const params = await searchParams;
  const forceOfflineNotice = params?.offline === "1";
  const entries = getPreviewEntries();
  const searchIndex = buildSearchIndex(entries);

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <ArchiveOfflineNotice force={forceOfflineNotice} />

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
            <ArchiveIndex entries={entries} searchIndex={searchIndex} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
