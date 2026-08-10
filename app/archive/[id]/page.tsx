import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPreviewEntries } from "@/lib/archive/index";
import { getRelatedEntries } from "@/lib/archive/related";
import { ARCHIVE_MEDIUM_TAGS } from "@/lib/archive/labels";
import type { ArchiveEntry } from "@/lib/archive/types";
import { CONTACT_EMAIL } from "@/lib/site";
import ArchiveCard from "@/components/archive/ArchiveCard";
import ArchiveLens from "@/components/archive/ArchiveLens";
import styles from "./page.module.css";

export const dynamicParams = false;

type PageProps = {
  params: Promise<{ id: string }>;
};

function sourceHostname(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return sourceUrl;
  }
}

export function generateStaticParams() {
  return getPreviewEntries().map((entry) => ({ id: entry.id }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const entry = getPreviewEntries().find((item) => item.id === id);
  if (!entry) {
    return { title: "Not found" };
  }

  // TODO: add JSON-LD structured data once entries publish.
  return {
    title: `${entry.title} | The Beautiful Archive`,
    description: entry.logline,
    openGraph: {
      title: `${entry.title} | The Beautiful Archive`,
      description: entry.logline,
    },
    ...(entry.status !== "published"
      ? { robots: { index: false, follow: false } }
      : {}),
  };
}

function FactsStrip({ entry }: { entry: ArchiveEntry }) {
  const titleCase = (value: string) =>
    value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

  const facts: { label: string; value: string }[] = [
    { label: "Language", value: entry.language },
    ...(entry.runtimeOrLength
      ? [{ label: "Length", value: entry.runtimeOrLength }]
      : []),
    { label: "Subject", value: entry.subjectName },
    { label: "Region", value: entry.region },
    { label: "Tone", value: titleCase(entry.tone) },
    { label: "Difficulty", value: titleCase(entry.difficulty) },
    ...(entry.awards ? [{ label: "Awards", value: entry.awards }] : []),
  ];

  return (
    <dl className={styles.facts}>
      {facts.map((fact) => (
        <div key={fact.label} className={styles.fact}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function ArchiveEntryPage({ params }: PageProps) {
  const { id } = await params;
  const pool = getPreviewEntries();
  const entry = pool.find((item) => item.id === id);
  if (!entry) notFound();

  const related = getRelatedEntries(entry, pool, 3);
  const byline = [entry.creator, entry.year == null ? null : String(entry.year), entry.country]
    .filter(Boolean)
    .join(" · ");
  const correctionMailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    `Archive correction: ${entry.title}`,
  )}`;

  return (
    <article className={styles.page}>
      {entry.status === "holding" ? (
        <div className={styles.banner} role="status">
          Unverified. Not published.
        </div>
      ) : null}

      <div className={styles.inner}>
        <Link href="/archive" className={styles.back}>
          All entries
        </Link>

        <p className={styles.medium}>{ARCHIVE_MEDIUM_TAGS[entry.medium]}</p>

        <h1 className={styles.title}>{entry.title}</h1>
        {entry.originalTitle ? (
          <p className={styles.originalTitle}>{entry.originalTitle}</p>
        ) : null}

        <p className={styles.byline}>{byline}</p>

        <p className={styles.logline}>{entry.logline}</p>

        <hr className={styles.rule} />

        <p className={styles.why}>{entry.whyItMatters}</p>

        <ArchiveLens entryId={entry.id} />

        <FactsStrip entry={entry} />

        <div className={styles.where}>
          <p className={styles.whereBody}>{entry.whereToFind}</p>
          {entry.availabilityNote ? (
            <p className={styles.availability}>{entry.availabilityNote}</p>
          ) : null}
        </div>

        <p className={styles.source}>
          <a
            href={entry.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.sourceLink}
          >
            Source
          </a>
          <span aria-hidden="true" className={styles.sourceSep}>
            ·
          </span>
          <span className={styles.sourceHost}>
            {sourceHostname(entry.sourceUrl)}
          </span>
        </p>

        <p className={styles.accuracy}>
          Entries are compiled and edited by hand. If something here is wrong,{" "}
          <a href={correctionMailto} className={styles.accuracyLink}>
            tell us
          </a>{" "}
          and we will correct it.
        </p>

        {related.length > 0 ? (
          <section className={styles.related} aria-labelledby="related-heading">
            <h2 id="related-heading" className={styles.relatedHeading}>
              Related
            </h2>
            <ul className={styles.relatedGrid}>
              {related.map((item) => (
                <li key={item.id}>
                  <ArchiveCard entry={item} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}
