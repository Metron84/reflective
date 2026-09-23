import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
} from "@/lib/ultima/constants";
import UltimaCountryTag from "./UltimaCountryTag";
import UltimaRow from "./UltimaRow";
import UltimaStaffMessage from "./UltimaStaffMessage";
import UltimaStatusBar from "./UltimaStatusBar";
import styles from "./ultima.module.css";

export default function UltimaDraftPicks({ picks = [], youId, floor = null }) {
  const yours = (picks ?? []).filter((pick) => pick.manager_id === youId);
  const counts = floor?.counts ?? {};

  if (!yours.length) {
    return (
      <UltimaStaffMessage
        subject="No picks yet"
        body="Your picks land here, grouped by country, as the board fills."
      />
    );
  }

  return (
    <div className={styles.dPicks}>
      {ULTIMA_LEAGUES.map((league) => {
        const rows = yours.filter((pick) => pick.player?.league === league);
        const filled = counts[league] ?? rows.length;
        return (
          <div key={league}>
            <UltimaStatusBar
              label={ULTIMA_LEAGUE_SHORT[league] ?? league}
              value={`${filled}/${ULTIMA_SQUAD_FLOOR_PER_LEAGUE}`}
              ratio={filled / ULTIMA_SQUAD_FLOOR_PER_LEAGUE}
            />
            {rows.length ? (
              rows.map((pick) => (
                <UltimaRow
                  key={pick.pick_number}
                  yours
                  primary={pick.player?.name ?? "-"}
                  meta={`${pick.player?.club || "-"} · Pick ${pick.pick_number}`}
                  number={<UltimaCountryTag league={league} />}
                />
              ))
            ) : (
              <p className={styles.dPicksNote}>No picks from this country yet.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
