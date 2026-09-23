"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { ultimaColourHex } from "@/lib/ultima/constants";
import UltimaCountryTag from "./UltimaCountryTag";
import UltimaPanel from "./UltimaPanel";
import UltimaRow from "./UltimaRow";
import UltimaStaffMessage from "./UltimaStaffMessage";
import UltimaStatsStrip from "./UltimaStatsStrip";
import UltimaValueNumber from "./UltimaValueNumber";
import styles from "./ultima.module.css";

function formTone(rank) {
  if (rank == null) return "empty";
  if (rank <= 3) return "high";
  if (rank <= 7) return "mid";
  return "low";
}

function FormSquares({ form = [] }) {
  if (!form.length) return <span className={styles.tbDash}>-</span>;
  return (
    <span className={styles.tbForm} aria-label="Last five ranks">
      {form.map((rank, index) => (
        <span
          key={`${rank ?? "x"}-${index}`}
          className={
            formTone(rank) === "high"
              ? styles.tbSqHigh
              : formTone(rank) === "mid"
                ? styles.tbSqMid
                : formTone(rank) === "low"
                  ? styles.tbSqLow
                  : styles.tbSqEmpty
          }
        />
      ))}
    </span>
  );
}

function Movement({ value }) {
  if (value == null || value === 0) return null;
  if (value > 0) return <span className={styles.tbMoveUp} aria-label="Up">↑</span>;
  return <span className={styles.tbMoveDown} aria-label="Down">↓</span>;
}

function TableRow({
  row,
  yours,
  showGwCols,
  motw,
  gwPoints,
  onSelect,
  rowRef,
}) {
  const pts = showGwCols ? row.seasonPoints : gwPoints;
  return (
    <button
      type="button"
      ref={rowRef}
      className={[
        yours ? styles.tbRowYou : styles.tbRow,
        showGwCols ? styles.tbRowSeason : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--team": ultimaColourHex(row.colour) }}
      onClick={() => onSelect(row.id)}
    >
      <span className={styles.tbPos}>{row.rank ?? "-"}</span>
      <span className={styles.tbClub}>
        <span className={styles.tbName}>{row.team_name}</span>
        <span className={styles.tbMgr}>
          {row.manager_name || (row.is_bot ? "BOT" : "-")}
        </span>
        {motw ? <span className={styles.tbMotw}>Manager of the week</span> : null}
      </span>
      {showGwCols ? (
        <>
          <span className={styles.tbFormCell}>
            <FormSquares form={row.form} />
          </span>
          <span className={styles.tbHide}>
            <UltimaValueNumber value={row.gameweekPoints} digits={0} />
          </span>
          <span className={styles.tbHide}>
            <UltimaValueNumber value={row.boltPoints} digits={0} />
          </span>
          <span className={styles.tbHide}>
            <UltimaValueNumber value={row.highestGw} digits={0} />
          </span>
          <span className={styles.tbHide}>
            <Movement value={row.movement} />
          </span>
        </>
      ) : null}
      <span className={styles.tbPts}>
        <UltimaValueNumber value={pts} digits={0} />
      </span>
    </button>
  );
}

export default function UltimaTableClient({ office }) {
  const [mode, setMode] = useState("season");
  const [gwIndex, setGwIndex] = useState(() => {
    const list = office?.gameweeks ?? [];
    const live = list.findIndex((gw) => gw.live);
    if (live >= 0) return live;
    return Math.max(0, list.length - 1);
  });
  const [openId, setOpenId] = useState(null);
  const [pinYou, setPinYou] = useState(false);
  const scrollRef = useRef(null);
  const youRef = useRef(null);

  const rows = office?.rows ?? [];
  const gameweeks = office?.gameweeks ?? [];
  const selectedGw = gameweeks[gwIndex] ?? null;
  const open = rows.find((row) => row.id === openId) ?? null;

  const displayRows = useMemo(() => {
    if (mode !== "gameweek" || !selectedGw) return rows;
    const byId = new Map(rows.map((row) => [row.id, row]));
    return selectedGw.rows.map((entry) => {
      const base = byId.get(entry.id);
      return {
        ...base,
        rank: entry.rank,
        gameweekPoints: entry.points,
        motw: entry.motw,
      };
    });
  }, [mode, rows, selectedGw]);

  useEffect(() => {
    const root = scrollRef.current;
    const el = youRef.current;
    if (!root || !el) {
      setPinYou(false);
      return undefined;
    }
    const obs = new IntersectionObserver(
      ([entry]) => setPinYou(!entry.isIntersecting),
      { root, threshold: 0.99 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [displayRows, mode, gwIndex]);

  if (!office) {
    return (
      <UltimaStaffMessage
        subject="The table did not load"
        body="The office could not read league state. Refresh the page."
      />
    );
  }

  const season = mode === "season";
  const youDisplay = displayRows.find((row) => row.yours);

  return (
    <div className={styles.tbPage}>
      <UltimaStatsStrip items={office.stats} />

      <div className={styles.hubTabs} role="tablist" aria-label="Table view">
        <button
          type="button"
          className={season ? styles.deskTabOn : styles.deskTab}
          onClick={() => setMode("season")}
        >
          Season
        </button>
        <button
          type="button"
          className={!season ? styles.deskTabOn : styles.deskTab}
          onClick={() => setMode("gameweek")}
        >
          Gameweek
        </button>
      </div>

      {office.beforeFirst ? (
        <>
          <UltimaStaffMessage
            subject="The table opens after the first gameweek."
          />
          <UltimaPanel title="Draft order">
            {(office.draftOrder ?? []).map((seat) => (
              <UltimaRow
                key={seat.id}
                yours={seat.yours}
                className={styles.tbDraftRow}
                primary={`${seat.draft_slot ?? "-"}. ${seat.team_name}`}
                meta={seat.manager_name || "-"}
              />
            ))}
          </UltimaPanel>
        </>
      ) : (
        <div className={styles.tbDesk}>
          <div className={styles.tbMain}>
            <UltimaPanel
              raised
              title={office.seasonLabel}
              action={
                <span className={styles.tbGwLabel}>
                  {season
                    ? office.afterGw
                      ? `After GW${office.afterGw}`
                      : "-"
                    : selectedGw
                      ? `GW${selectedGw.number}`
                      : "-"}
                </span>
              }
            >
              {!season && gameweeks.length ? (
                <div className={styles.tbPicker}>
                  <button
                    type="button"
                    className={styles.tbArrow}
                    disabled={gwIndex <= 0}
                    onClick={() => setGwIndex((n) => Math.max(0, n - 1))}
                    aria-label="Previous gameweek"
                  >
                    ‹
                  </button>
                  <p className={styles.tbPickerNum}>
                    GW{selectedGw?.number ?? "-"}
                    {selectedGw?.live ? <span className={styles.sqLive}> LIVE</span> : null}
                  </p>
                  <button
                    type="button"
                    className={styles.tbArrow}
                    disabled={gwIndex >= gameweeks.length - 1}
                    onClick={() => setGwIndex((n) => Math.min(gameweeks.length - 1, n + 1))}
                    aria-label="Next gameweek"
                  >
                    ›
                  </button>
                </div>
              ) : null}

              {office.showSyncNote ? (
                <UltimaStaffMessage subject="Scores update when Sportmonks confirms both sides." />
              ) : null}

              <div className={season ? `${styles.tbHead} ${styles.tbRowSeason}` : styles.tbHead} aria-hidden>
                <span>Pos</span>
                <span>Club</span>
                {season ? <span>Form</span> : null}
                {season ? <span className={styles.tbHide}>GW</span> : null}
                {season ? <span className={styles.tbHide}>Bolt</span> : null}
                {season ? <span className={styles.tbHide}>Best</span> : null}
                {season ? <span className={styles.tbHide}>+/-</span> : null}
                <span>Pts</span>
              </div>

              <div className={styles.tbScroll} ref={scrollRef}>
                {displayRows.map((row) => (
                  <TableRow
                    key={row.id}
                    row={row}
                    yours={row.yours}
                    showGwCols={season}
                    motw={!season && row.motw}
                    gwPoints={row.gameweekPoints}
                    onSelect={setOpenId}
                    rowRef={row.yours ? youRef : undefined}
                  />
                ))}
              </div>

              {pinYou && youDisplay ? (
                <div className={styles.tbPin}>
                  <TableRow
                    row={youDisplay}
                    yours
                    showGwCols={season}
                    motw={!season && youDisplay.motw}
                    gwPoints={youDisplay.gameweekPoints}
                    onSelect={setOpenId}
                  />
                </div>
              ) : null}
            </UltimaPanel>
          </div>

          <div className={styles.tbSide}>
            <UltimaPanel title="Bolt">
              {(office.bolt ?? []).length ? (
                office.bolt.map((row) => (
                  <UltimaRow
                    key={row.id}
                    yours={row.yours}
                    className={styles.tbDraftRow}
                    primary={row.team_name}
                    meta={`${row.boltHits} hit${row.boltHits === 1 ? "" : "s"}`}
                    number={<UltimaValueNumber value={row.boltPoints} digits={0} />}
                  />
                ))
              ) : (
                <UltimaStaffMessage
                  subject="No Bolt bonuses yet"
                  body="Bolt lands when an eligible player clears the threshold."
                />
              )}
            </UltimaPanel>

            {open ? (
              <div className={styles.tbSheetDesk}>
                <ClubSheet
                  row={open}
                  xv={office.xvVisible ? office.xvByManager?.[open.id] : null}
                  xvVisible={office.xvVisible}
                  onClose={() => setOpenId(null)}
                  desktop
                />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {open && !office.beforeFirst ? (
        <div className={styles.tbSheetMobile}>
          <ClubSheet
            row={open}
            xv={office.xvVisible ? office.xvByManager?.[open.id] : null}
            xvVisible={office.xvVisible}
            onClose={() => setOpenId(null)}
          />
        </div>
      ) : null}
    </div>
  );
}

function ClubSheet({ row, xv, xvVisible, onClose, desktop = false }) {
  const body = (
    <>
      <p className={styles.dSheetName}>{row.team_name}</p>
      <p className={styles.dSheetMeta}>{row.manager_name || (row.is_bot ? "BOT" : "-")}</p>
      <p className={styles.dSheetMeta}>
        Season points {row.seasonPoints ?? "-"}
      </p>
      <p className={styles.dSheetMeta}>
        Last 5
        {row.lastScores?.length
          ? `: ${row.lastScores.map((s) => (s.points == null ? "-" : s.points)).join(" · ")}`
          : ": -"}
      </p>
      {xvVisible && xv ? (
        ULTIMA_LEAGUES.map((league) => (
          <div key={league}>
            <p className={styles.tbXvHead}>
              <UltimaCountryTag league={league} />
            </p>
            {(xv[league] ?? []).length ? (
              (xv[league] ?? []).map((name) => (
                <p key={name} className={styles.dSheetMeta}>
                  {name}
                </p>
              ))
            ) : (
              <p className={styles.dSheetMeta}>-</p>
            )}
          </div>
        ))
      ) : (
        <UltimaStaffMessage
          subject="XV hidden"
          body="Lineups stay private until this gameweek locks."
        />
      )}
    </>
  );

  if (desktop) {
    return (
      <UltimaPanel title="Club" action={<button type="button" className={styles.opPanelAction} onClick={onClose}>Close</button>}>
        <div className={styles.tbClubPad}>{body}</div>
      </UltimaPanel>
    );
  }

  return (
    <div className={styles.dSheet} role="dialog" aria-modal="true" aria-label={row.team_name}>
      <button type="button" className={styles.dSheetBackdrop} aria-label="Close" onClick={onClose} />
      <div className={styles.dSheetPanel}>{body}</div>
    </div>
  );
}
