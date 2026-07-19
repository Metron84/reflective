import styles from "./StarterChips.module.css";

export const STARTER_PROMPTS = [
  "Where can 8 of us watch outside tonight?",
  "Best fan moments from the World Cup",
  "Which venue has the loudest fans?",
  "Show me high-energy indoor venues",
];

export default function StarterChips({ onSelect, disabled }) {
  return (
    <div className={styles.wrap} role="group" aria-label="Suggested questions">
      <p className={styles.label}>Try asking</p>
      <div className={styles.chips}>
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className={styles.chip}
            disabled={disabled}
            onClick={() => onSelect(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
