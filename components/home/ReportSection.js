import Link from "next/link";
import { REPORT_DOI, REPORT_FINDINGS, REPORT_STATS } from "@/lib/report";
import styles from "./ReportSection.module.css";

export default function ReportSection() {
  return (
    <section className={styles.section} aria-labelledby="report-heading">
      <div className={styles.inner}>
        <h2 id="report-heading" className={styles.heading}>
          We asked the fans.
        </h2>

        <p className={styles.standfirst}>
          Interviews filmed from May to the World Cup final, in Dubai and
          beyond.
        </p>

        <ul className={styles.chips}>
          {REPORT_STATS.map((stat) => (
            <li key={stat.label} className={styles.chip}>
              <span className={styles.chipValue}>{stat.value}</span>
              <span className={styles.chipLabel}>{stat.label}</span>
            </li>
          ))}
        </ul>

        <div className={styles.findings}>
          {REPORT_FINDINGS.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        <div className={styles.actions}>
          <a
            href={REPORT_DOI}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.primary}
          >
            Read the report
          </a>
          <Link href="/films" className={styles.secondary}>
            See the footage behind it
          </Link>
        </div>
      </div>
    </section>
  );
}
