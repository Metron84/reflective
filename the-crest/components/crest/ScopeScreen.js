"use client";

import { SCOPE_OPTIONS } from "@the-crest/lib/scope";
import BackButton from "./BackButton";
import styles from "./ScopeScreen.module.css";

/**
 * @param {{
 *   value: string;
 *   onChange: (id: string) => void;
 *   onBegin: () => void;
 *   onBack: () => void;
 * }} props
 */
export default function ScopeScreen({ value, onChange, onBegin, onBack }) {
  return (
    <section className={styles.screen}>
      <h2 className={styles.q}>Where are you looking?</h2>
      <p className={styles.sub}>This sets the map. Your answers stay the same.</p>
      <div className={styles.opts} role="group" aria-label="Where are you looking?">
        {SCOPE_OPTIONS.map((option) => {
          const selected = value === option.id;
          const isDefault = option.id === "all";
          return (
            <button
              key={option.id}
              type="button"
              className={`${styles.opt} ${selected ? styles.picked : ""}`}
              aria-pressed={selected}
              onClick={() => onChange(option.id)}
            >
              <span>{option.label}</span>
              {isDefault ? (
                <span className={styles.defaultMark}>Default</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <button type="button" className={styles.begin} onClick={onBegin}>
        Begin the journey
      </button>
      <BackButton onBack={onBack} journey />
    </section>
  );
}
