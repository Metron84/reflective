import styles from "./ultima.module.css";

export default function UltimaStatsStrip({ items = [] }) {
  if (!items.length) return null;

  return (
    <div className={styles.opStats}>
      {items.map((item) => (
        <div key={item.label ?? item.value}>
          {item.label ? <p className={styles.opStatLabel}>{item.label}</p> : null}
          <p className={styles.opStatValue}>{item.value ?? item.node ?? "-"}</p>
          {item.delta ? (
            <p
              className={
                item.deltaTone === "up"
                  ? styles.opStatDeltaUp
                  : item.deltaTone === "muted"
                    ? styles.opStatDeltaMuted
                    : styles.opStatDelta
              }
            >
              {item.delta}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
