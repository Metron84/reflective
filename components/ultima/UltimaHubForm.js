"use client";

import { useMemo, useState } from "react";
import { ULTIMA_LEAGUES, ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";
import UltimaCountryTag from "./UltimaCountryTag";
import UltimaRow from "./UltimaRow";
import UltimaStaffMessage from "./UltimaStaffMessage";
import UltimaValueNumber, { percentileInList } from "./UltimaValueNumber";
import styles from "./ultima.module.css";

const EMPTY = {
  pl: "No English form synced yet. The scouts report when Sportmonks does.",
  laliga: "No Spanish form synced yet. The scouts report when Sportmonks does.",
  seriea: "No Italian form synced yet. The scouts report when Sportmonks does.",
  bundesliga: "No German form synced yet. The scouts report when Sportmonks does.",
  ligue1: "No French form synced yet. The scouts report when Sportmonks does.",
};

export default function UltimaHubForm({ teams = [], players = [] }) {
  const [kind, setKind] = useState("teams");
  const [league, setLeague] = useState("pl");

  const teamRows = useMemo(() => {
    return [...teams]
      .filter((row) => row.league === league)
      .sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0))
      .slice(0, 8);
  }, [teams, league]);

  const playerRows = useMemo(() => {
    return [...players]
      .filter((row) => row.league === league)
      .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
      .slice(0, 8);
  }, [players, league]);

  const rows = kind === "teams" ? teamRows : playerRows;
  const values =
    kind === "teams"
      ? teamRows.map((row) => row.heat)
      : playerRows.map((row) => row.rating);

  return (
    <>
      <div className={styles.hubTabs} role="tablist" aria-label="Form kind">
        <button
          type="button"
          className={kind === "teams" ? styles.deskTabOn : styles.deskTab}
          onClick={() => setKind("teams")}
        >
          Teams
        </button>
        <button
          type="button"
          className={kind === "players" ? styles.deskTabOn : styles.deskTab}
          onClick={() => setKind("players")}
        >
          Players
        </button>
      </div>
      <div className={styles.hubTabs} role="tablist" aria-label="Country">
        {ULTIMA_LEAGUES.map((id) => (
          <button
            key={id}
            type="button"
            className={league === id ? styles.deskTabOn : styles.deskTab}
            onClick={() => setLeague(id)}
          >
            {ULTIMA_LEAGUE_SHORT[id]}
          </button>
        ))}
      </div>
      {!rows.length ? (
        <UltimaStaffMessage subject="A note from the staff" body={EMPTY[league]} />
      ) : kind === "teams" ? (
        teamRows.map((row) => (
          <UltimaRow
            key={row.clubId ?? row.club}
            primary={row.club}
            meta={(row.last5 ?? []).join(" ") || undefined}
            number={
              <UltimaValueNumber
                value={row.heat}
                percentile={percentileInList(row.heat, values)}
                digits={1}
              />
            }
          />
        ))
      ) : (
        playerRows.map((row) => (
          <UltimaRow
            key={row.playerId ?? row.name}
            primary={row.name}
            meta={row.club || undefined}
            number={
              <span className={styles.hubFormNumber}>
                <UltimaCountryTag league={row.league} />
                <UltimaValueNumber
                  value={row.rating}
                  percentile={percentileInList(row.rating, values)}
                  digits={1}
                />
              </span>
            }
          />
        ))
      )}
    </>
  );
}
