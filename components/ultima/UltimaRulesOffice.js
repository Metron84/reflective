import {
  RULES_ANCHORS,
  RULES_BOLT,
  RULES_DRAFT,
  RULES_FLOOR,
  RULES_LOCKING,
  RULES_OFFICE_SCORING,
  RULES_TRADE,
} from "@/lib/ultima/rules-content";
import UltimaPanel from "./UltimaPanel";
import UltimaRow from "./UltimaRow";
import styles from "./ultima.module.css";

export default function UltimaRulesOffice() {
  return (
    <div className={styles.ruPage}>
      <nav className={styles.ruChips} aria-label="Rules sections">
        {RULES_ANCHORS.map((item) => (
          <a key={item.id} href={`#${item.id}`} className={styles.deskTab}>
            {item.label}
          </a>
        ))}
      </nav>

      <UltimaPanel raised title="Scoring" id="scoring">
        {RULES_OFFICE_SCORING.map((row) => (
          <UltimaRow key={row.label} primary={row.label} number={row.value} />
        ))}
      </UltimaPanel>

      <UltimaPanel title="Floor" id="floor">
        {RULES_FLOOR.map((line) => (
          <UltimaRow key={line} primary={line} />
        ))}
        <UltimaRow primary={RULES_LOCKING} />
      </UltimaPanel>

      <UltimaPanel title="Bolt" id="bolt">
        <UltimaRow primary={RULES_BOLT} />
      </UltimaPanel>

      <UltimaPanel title="Draft" id="draft">
        {RULES_DRAFT.map((line) => (
          <UltimaRow key={line} primary={line} />
        ))}
      </UltimaPanel>

      <UltimaPanel title="Trade window" id="trade">
        {RULES_TRADE.map((line) => (
          <UltimaRow key={line} primary={line} />
        ))}
      </UltimaPanel>
    </div>
  );
}
