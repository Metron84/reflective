import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import UltimaCountryTag from "./UltimaCountryTag";
import styles from "./ultima.module.css";

/**
 * Five countries, one captain each. A filled cell shows his name with the C badge.
 * Empty cells read "No captain". Read-only unless onOpen is given.
 */
export default function UltimaCaptainStrip({
  captains = {},
  playersById = new Map(),
  lockedLeagues = [],
  onOpen = null,
}) {
  return (
    <div className={styles.capStrip} role="list" aria-label="Captains">
      {ULTIMA_LEAGUES.map((league) => {
        const id = captains?.[league] ?? null;
        const name = id ? (playersById.get(id)?.name ?? null) : null;
        const body = (
          <>
            <UltimaCountryTag league={league} />
            <span className={name ? styles.capName : styles.capNone}>
              {name ? (
                <>
                  <span className={styles.sqCap}>C</span> {name}
                </>
              ) : (
                "No captain"
              )}
            </span>
          </>
        );
        const locked = lockedLeagues.includes(league);
        return onOpen && name ? (
          <button
            key={league}
            type="button"
            role="listitem"
            className={locked ? styles.capCellLocked : styles.capCell}
            onClick={() => onOpen(id)}
          >
            {body}
          </button>
        ) : (
          <div
            key={league}
            role="listitem"
            className={locked ? styles.capCellLocked : styles.capCell}
          >
            {body}
          </div>
        );
      })}
    </div>
  );
}
