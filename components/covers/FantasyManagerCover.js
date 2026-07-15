import styles from "./FantasyManagerCover.module.css";

export default function FantasyManagerCover() {
  return (
    <div className={styles.root} aria-hidden="true">
      <svg className={styles.art} viewBox="0 0 320 180" fill="none">
        {/* Pitch outline */}
        <rect
          x="40"
          y="24"
          width="240"
          height="132"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.35"
        />
        <line
          x1="160"
          y1="24"
          x2="160"
          y2="156"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.25"
        />
        <circle
          cx="160"
          cy="90"
          r="28"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.2"
        />
        {/* Draft rows */}
        {[0, 1, 2, 3, 4].map((row) => (
          <g key={row} opacity={0.22 - row * 0.02}>
            <rect
              x="52"
              y={34 + row * 22}
              width="88"
              height="14"
              stroke="currentColor"
              strokeWidth="1"
            />
            <rect
              x="180"
              y={34 + row * 22}
              width="88"
              height="14"
              stroke="currentColor"
              strokeWidth="1"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
