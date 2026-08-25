"use client";

import { useId, useState } from "react";
import styles from "./TrainingCommitment.module.css";

const WEEKS = [
  {
    week: "Week 1",
    module: "The Interview",
    bring: "A notebook and one question you want answered.",
  },
  {
    week: "Week 2",
    module: "Filming",
    bring: "Your phone charged. No camera required.",
  },
  {
    week: "Week 3",
    module: "Live shoot",
    bring: "Comfortable shoes and a full day clear.",
  },
  {
    week: "Week 4",
    module: "The Edit and Distribution",
    bring: "Your raw footage from the shoot.",
  },
];

const INCLUDED = [
  "Four sessions",
  "The weekend live shoot",
  "Equipment on the day",
  "Certificate",
  "Reference letter",
  "Individual feedback",
];

const NOT_INCLUDED = ["Your transport to and from the shoot"];

const FAQS = [
  {
    q: "Do I need my own camera?",
    a: "No, equipment is provided on the shoot day.",
  },
  {
    q: "Do I need experience?",
    a: "No, the course starts from the beginning.",
  },
  {
    q: "What if I miss a session?",
    a: "You get one catch-up call.",
  },
  {
    q: "Do I get the footage?",
    a: "Yes, for your own portfolio.",
  },
  {
    q: "Is there a job at the end?",
    a: "No, this is training, and you leave with work and a reference.",
  },
];

function FaqItem({ item, index, openIndex, onToggle }) {
  const panelId = useId();
  const isOpen = openIndex === index;

  return (
    <div className={styles.faqItem}>
      <button
        type="button"
        className={styles.faqToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => onToggle(isOpen ? -1 : index)}
      >
        <span className={styles.faqQMark}>Q:</span>
        <span className={styles.faqQuestion}>{item.q}</span>
      </button>
      {isOpen ? (
        <div id={panelId} className={styles.faqAnswer}>
          <span className={styles.faqAMark}>A:</span>
          <span className={styles.faqAnswerText}>{item.a}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function TrainingCommitment() {
  const [openFaq, setOpenFaq] = useState(-1);

  return (
    <section
      className={styles.section}
      aria-labelledby="training-commitment-title"
    >
      <div className={styles.inner}>
        <h2 id="training-commitment-title" className={styles.heading}>
          Four weeks. AED 2,500.
        </h2>
        <p className={styles.intro}>
          Founding cohort rate for the first four seats. AED 3,500 thereafter.
        </p>

        <div className={styles.callSheet}>
          <div className={styles.callSheetHeader} aria-hidden="true">
            <span>Week</span>
            <span>Module</span>
            <span>What you bring</span>
          </div>
          <ol className={styles.callSheetRows}>
            {WEEKS.map((entry) => (
              <li key={entry.week} className={styles.callSheetRow}>
                <div className={styles.callSheetCell}>
                  <span className={styles.callSheetLabel}>Week</span>
                  <span className={styles.callSheetWeek}>{entry.week}</span>
                </div>
                <div className={styles.callSheetCell}>
                  <span className={styles.callSheetLabel}>Module</span>
                  <span className={styles.callSheetModule}>{entry.module}</span>
                </div>
                <div className={styles.callSheetCell}>
                  <span className={styles.callSheetLabel}>What you bring</span>
                  <span className={styles.callSheetBring}>{entry.bring}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className={styles.dealMemo}>
          <div className={styles.dealColumn}>
            <h3 className={styles.dealHeading}>Included</h3>
            <ul className={styles.includedList}>
              {INCLUDED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className={styles.dealColumn}>
            <h3 className={styles.dealHeading}>Not included</h3>
            <ul className={styles.notIncludedList}>
              {NOT_INCLUDED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.faq}>
          {FAQS.map((item, index) => (
            <FaqItem
              key={item.q}
              item={item}
              index={index}
              openIndex={openFaq}
              onToggle={setOpenFaq}
            />
          ))}
        </div>
      </div>

      <div className={styles.stripWrap}>
        <div className={styles.stripRule} aria-hidden="true" />
        {/* TODO: replace with five real frames cut from published footage, then apply a navy multiply overlay at roughly 60%. */}
        <div className={styles.strip} aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className={styles.stripCell} />
          ))}
        </div>
      </div>
    </section>
  );
}
