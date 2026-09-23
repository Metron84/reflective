import { ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";
import styles from "./ultima.module.css";

export default function UltimaCountryTag({ league }) {
  const label = ULTIMA_LEAGUE_SHORT[league] ?? String(league ?? "").toUpperCase();
  if (!label) return null;
  return <span className={styles.opTag}>{label}</span>;
}
