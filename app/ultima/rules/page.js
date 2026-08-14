import UltimaRulesBody from "@/components/ultima/UltimaRulesBody";
import styles from "@/components/ultima/ultima.module.css";
import { ULTIMA_ENABLED } from "@/lib/config";

export const metadata = {
  title: "Ultima · Rules",
  description: "Canonical scoring, floors and locks for Ultima.",
  alternates: { canonical: "/ultima/rules" },
  robots: ULTIMA_ENABLED ? undefined : { index: false, follow: false },
};

export default function UltimaRulesPage() {
  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>Rules</h1>
        <UltimaRulesBody />
      </div>
    </div>
  );
}
