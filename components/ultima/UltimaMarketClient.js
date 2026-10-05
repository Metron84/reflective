"use client";

import { useState } from "react";
import { ULTIMA_LEAGUES, ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";
import UltimaCountryTag from "./UltimaCountryTag";
import UltimaDraftPicker from "./UltimaDraftPicker";
import UltimaLocalTime from "./UltimaLocalTime";
import UltimaPanel from "./UltimaPanel";
import { useUltimaPlayerCard } from "./UltimaPlayerCard";
import UltimaStaffMessage from "./UltimaStaffMessage";
import UltimaStatsStrip from "./UltimaStatsStrip";
import styles from "./ultima.module.css";

function FormDots({ form = [] }) {
  if (!form.length) return <span className={styles.tbDash}>-</span>;
  return (
    <span className={styles.tbForm} aria-label="Last five results">
      {form.map((result, index) => (
        <span
          key={`${result}-${index}`}
          className={
            result === "W"
              ? styles.tbSqHigh
              : result === "D"
                ? styles.tbSqMid
                : result === "L"
                  ? styles.tbSqLow
                  : styles.tbSqEmpty
          }
        />
      ))}
    </span>
  );
}

export default function UltimaMarketClient({ office }) {
  const [tab, setTab] = useState("free");
  const [league, setLeague] = useState("pl");
  const [clubFilter, setClubFilter] = useState("");
  const { openPlayer: openCard } = useUltimaPlayerCard();
  const [watchedIds, setWatchedIds] = useState(office?.watchedIds ?? []);

  // Shortlisted players sit at the top of the market.
  const freeAgents = office?.freeAgents ?? [];
  const pool =
    tab === "watch"
      ? [
          ...freeAgents.filter((player) => watchedIds.includes(player.id)),
          ...(office?.watchlist ?? []).filter((player) => player.signedBy),
        ]
      : [
          ...freeAgents.filter((player) => watchedIds.includes(player.id)),
          ...freeAgents.filter((player) => !watchedIds.includes(player.id)),
        ];
  if (!office) {
    return (
      <UltimaStaffMessage
        subject="The market did not load"
        body="The office could not read free agents. Refresh the page."
      />
    );
  }

  const hideActions = !office.marketOpen;
  const tableRows = office.tables?.[league] ?? [];

  async function toggleWatch(playerId, on) {
    setWatchedIds((ids) => {
      const next = new Set(ids);
      if (on) next.add(playerId);
      else next.delete(playerId);
      return [...next];
    });
    try {
      const res = await fetch("/api/ultima/market/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId, on }),
      });
      if (!res.ok) {
        setWatchedIds((ids) => {
          const next = new Set(ids);
          if (on) next.delete(playerId);
          else next.add(playerId);
          return [...next];
        });
      }
    } catch {
      setWatchedIds((ids) => {
        const next = new Set(ids);
        if (on) next.delete(playerId);
        else next.add(playerId);
        return [...next];
      });
    }
  }

  return (
    <div className={styles.mkPage}>
      <UltimaStatsStrip
        items={[
          {
            label: "Squad",
            value: `${office.squadSize}/${office.squadCap}`,
          },
          {
            label: "Floors",
            value: (
              <span className={styles.mkFloors}>
                {ULTIMA_LEAGUES.map((id) => (
                  <span key={id} className={styles.mkFloor}>
                    <UltimaCountryTag league={id} />
                    {office.floors?.[id] ?? 0}
                  </span>
                ))}
              </span>
            ),
          },
          {
            label: "Free agents",
            value: office.freeAgentCount != null ? String(office.freeAgentCount) : "-",
          },
          {
            label: office.marketOpen ? "Next lock" : "Reopens",
            value: office.marketOpen
              ? office.nextLock ?? "-"
              : office.reopenAt
                ? <UltimaLocalTime value={office.reopenAt} format="weekdayTime" />
                : "-",
          },
        ]}
      />

      <div className={styles.hubTabs} role="tablist" aria-label="Market">
        <button
          type="button"
          className={tab === "free" ? styles.deskTabOn : styles.deskTab}
          onClick={() => setTab("free")}
        >
          Free agents
        </button>
        <button
          type="button"
          className={tab === "watch" ? styles.deskTabOn : styles.deskTab}
          onClick={() => setTab("watch")}
        >
          Shortlist
        </button>
        <button
          type="button"
          className={tab === "scout" ? styles.deskTabOn : styles.deskTab}
          onClick={() => setTab("scout")}
        >
          Scouting
        </button>
      </div>

      {!office.draftComplete ? (
        <UltimaStaffMessage subject="Free agents open after the draft completes." />
      ) : !office.marketOpen ? (
        <UltimaStaffMessage subject="The market reopens after the gameweek." />
      ) : null}
      {!office.marketOpen && office.reopenAt ? (
        <p className={styles.mkReopen}>
          Reopens <UltimaLocalTime value={office.reopenAt} />
        </p>
      ) : null}

      {tab !== "scout" ? (
        <div className={styles.mkDesk}>
          <div className={styles.mkMain}>
            <UltimaPanel raised title={tab === "watch" ? "Shortlist" : "Free agents"}>
              <UltimaDraftPicker
                mode="market"
                available={pool}
                floor={office.floor}
                clubFilter={clubFilter}
                onClearClub={() => setClubFilter("")}
                watchedIds={watchedIds}
                hideActions={hideActions}
                onOpenPlayer={openCard}
                onWatch={toggleWatch}
                onSign={(player) => openCard(player.id)}
              />
            </UltimaPanel>
          </div>
        </div>
      ) : (
        <UltimaPanel raised title="Scouting">
          {office.showFormNote ? (
            <UltimaStaffMessage subject="Form updates when Sportmonks confirms the latest matches." />
          ) : null}
          <div className={styles.dPickFilters} role="tablist" aria-label="Country">
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
          <div className={styles.mkTableHead} aria-hidden>
            <span>Pos</span>
            <span>Club</span>
            <span>P</span>
            <span>GD</span>
            <span>Pts</span>
            <span>Form</span>
          </div>
          {tableRows.length ? (
            tableRows.map((row) => (
              <div key={`${league}-${row.clubId ?? row.club}`} className={styles.mkTableRow}>
                <span className={styles.tbPos}>{row.position ?? "-"}</span>
                <span className={styles.mkClubCell}>
                  <span className={styles.tbName}>{row.club || "-"}</span>
                  {row.faCount > 0 ? (
                    <button
                      type="button"
                      className={styles.mkFaChip}
                      onClick={() => {
                        setClubFilter(row.club);
                        setTab("free");
                      }}
                    >
                      {row.faCount} FA
                    </button>
                  ) : null}
                </span>
                <span>{row.played ?? "-"}</span>
                <span>{row.gd ?? "-"}</span>
                <span className={styles.tbPts}>{row.points ?? "-"}</span>
                <FormDots form={row.form} />
              </div>
            ))
          ) : (
            <UltimaStaffMessage
              subject="No table yet"
              body="Form updates when Sportmonks confirms the latest matches."
            />
          )}
        </UltimaPanel>
      )}

    </div>
  );
}
