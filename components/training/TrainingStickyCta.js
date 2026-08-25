"use client";

import { useEffect, useState } from "react";
import styles from "./TrainingStickyCta.module.css";

export default function TrainingStickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("training-hero");
    const apply = document.getElementById("apply");
    if (!hero || !apply) return undefined;

    let heroPast = false;
    let applyInView = false;

    function sync() {
      setVisible(heroPast && !applyInView);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target.id === "training-hero") {
            heroPast = !entry.isIntersecting;
          }
          if (entry.target.id === "apply") {
            applyInView = entry.isIntersecting;
          }
        }
        sync();
      },
      { threshold: 0 },
    );

    observer.observe(hero);
    observer.observe(apply);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={visible ? styles.barVisible : styles.bar}
      aria-hidden={!visible}
    >
      <div className={styles.inner}>
        <p className={styles.copy}>AED 2,500 · 4 seats</p>
        <a href="#apply" className={styles.cta} tabIndex={visible ? 0 : -1}>
          Apply
        </a>
      </div>
    </div>
  );
}
