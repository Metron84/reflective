"use client";

import { useMemo, useState } from "react";
import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
} from "@/lib/ultima/constants";
import { expectedUltimaPoints } from "@/lib/ultima/projected-points";
import UltimaCountryTag from "./UltimaCountryTag";
import UltimaDraftPicker from "./UltimaDraftPicker";
import UltimaLocalTime from "./UltimaLocalTime";
import UltimaPanel from "./UltimaPanel";
import UltimaPlayerSheet from "./UltimaPlayerSheet";
import UltimaRow from "./UltimaRow";
import UltimaStaffMessage from "./UltimaStaffMessage";
import UltimaStatsStrip from "./UltimaStatsStrip";
import UltimaValueNumber, { percentileInList } from "./UltimaValueNumber";
import styles from "./ultima.module.css";

function legalReleases(roster, incoming) {
  if (!incoming) return [];
  return (roster ?? []).filter((drop) => {
    if (drop.locked) return false;
    const next = Object.fromEntries(ULTIMA_LEAGUES.map((league) => [league, 0]));
    for (const player of roster) {
      if (player.id === drop.id) continue;
      if (player.league in next) next[player.league] += 1;
    }
    if (incoming.league in next) next[incoming.league] += 1;
    return ULTIMA_LEAGUES.every(
      (league) => (next[league] ?? 0) >= ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
    );
  });
}

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

function ReleaseSheet({ incoming, options, incomingPts, points, error, loading, onPick, onRetry, onClose, desktop }) {
  const body = (
    <>
      <p className={styles.dSheetName}>Release to sign {incoming.name}</p>
      <p className={styles.dSheetMeta}>
        Incoming{" "}
        <UltimaValueNumber
          value={Number.isFinite(incomingPts) ? incomingPts : null}
          percentile={percentileInList(incomingPts, points)}
          digits={1}
        />
      </p>
      {options.length ? (
        options.map((player) => {
          const pts = expectedUltimaPoints(player);
          return (
            <UltimaRow
              key={player.id}
              primary={player.name}
              meta={`${player.club || "-"} · ${player.position || "-"}`}
              number={
                <UltimaValueNumber
                  value={Number.isFinite(pts) ? pts : null}
                  percentile={percentileInList(pts, points)}
                  digits={1}
                />
              }
              onClick={() => onPick(player.id)}
            />
          );
        })
      ) : (
        <UltimaStaffMessage
          subject="No legal release"
          body="Every drop would break a country floor or a locked league."
        />
      )}
      {error ? (
        <UltimaStaffMessage subject={error} actionLabel="Retry" onAction={onRetry} />
      ) : null}
      {loading ? <p className={styles.dSheetMeta}>Signing…</p> : null}
    </>
  );

  if (desktop) {
    return (
      <UltimaPanel
        title="Release"
        action={
          <button type="button" className={styles.opPanelAction} onClick={onClose}>
            Close
          </button>
        }
      >
        <div className={styles.mkSheetPad}>{body}</div>
      </UltimaPanel>
    );
  }

  return (
    <div className={styles.dSheet} role="dialog" aria-modal="true" aria-label="Release a player">
      <button type="button" className={styles.dSheetBackdrop} aria-label="Close" onClick={onClose} />
      <div className={styles.dSheetPanel}>{body}</div>
    </div>
  );
}

export default function UltimaMarketClient({ office }) {
  const [tab, setTab] = useState("free");
  const [league, setLeague] = useState("pl");
  const [clubFilter, setClubFilter] = useState("");
  const [openId, setOpenId] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [watchedIds, setWatchedIds] = useState(office?.watchedIds ?? []);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastDrop, setLastDrop] = useState(null);

  const roster = office?.roster ?? [];
  const pool =
    tab === "watch"
      ? [
          ...(office?.freeAgents ?? []).filter((player) => watchedIds.includes(player.id)),
          ...(office?.watchlist ?? []).filter((player) => player.signedBy),
        ]
      : office?.freeAgents ?? [];
  const releases = incoming ? legalReleases(roster, incoming) : [];
  const incomingPts = incoming ? expectedUltimaPoints(incoming) : null;

  const comparePoints = useMemo(
    () => [incoming, ...releases].filter(Boolean).map((p) => expectedUltimaPoints(p)),
    [incoming, releases],
  );
  const sheetPoints = useMemo(
    () => pool.map((p) => expectedUltimaPoints(p)),
    [pool],
  );

  if (!office) {
    return (
      <UltimaStaffMessage
        subject="The market did not load"
        body="The office could not read free agents. Refresh the page."
      />
    );
  }

  const hideActions = !office.marketOpen;
  const openPlayer =
    [...(office.freeAgents ?? []), ...(office.watchlist ?? [])].find((p) => p.id === openId) ?? null;
  const needsRelease = incoming && roster.length >= office.squadCap;
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

  async function submitSign(dropId) {
    if (!incoming) return;
    if (roster.length >= office.squadCap && !dropId) return;
    setLoading(true);
    setError("");
    if (dropId) setLastDrop(dropId);
    try {
      const res = await fetch("/api/ultima/market/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          add_player_id: incoming.id,
          drop_player_id: dropId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "The market could not complete that.");
      } else {
        window.location.reload();
      }
    } catch {
      setError("Connection lost.");
    } finally {
      setLoading(false);
    }
  }

  async function submitSignDirect(player) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ultima/market/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add_player_id: player.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIncoming(player);
        setError(data.message ?? "The market could not complete that.");
      } else {
        window.location.reload();
      }
    } catch {
      setIncoming(player);
      setError("Connection lost.");
    } finally {
      setLoading(false);
    }
  }

  function startSign(player) {
    if (hideActions || player.signedBy) return;
    setError("");
    setIncoming(player);
    setOpenId(player.id);
    if (roster.length < office.squadCap) {
      submitSignDirect(player);
    }
  }

  const sheetActions = openPlayer
    ? [
        ...(!hideActions && !openPlayer.signedBy
          ? [{ label: "Sign", primary: true, disabled: loading, onClick: () => startSign(openPlayer) }]
          : []),
        {
          label: watchedIds.includes(openPlayer.id) ? "Remove star" : "Watch",
          onClick: () => toggleWatch(openPlayer.id, !watchedIds.includes(openPlayer.id)),
        },
      ]
    : [];

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
          Watchlist
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
            <UltimaPanel raised title={tab === "watch" ? "Watchlist" : "Free agents"}>
              <UltimaDraftPicker
                mode="market"
                available={pool}
                floor={office.floor}
                clubFilter={clubFilter}
                onClearClub={() => setClubFilter("")}
                watchedIds={watchedIds}
                hideActions={hideActions}
                embedSheet
                openPlayerId={openId}
                onOpenPlayer={setOpenId}
                onClosePlayer={() => setOpenId(null)}
                onWatch={toggleWatch}
                onSign={startSign}
              />
            </UltimaPanel>
          </div>
          <div className={styles.mkSide}>
            {openPlayer ? (
              <div className={styles.mkSheetDesk}>
                <UltimaPanel
                  title="Player"
                  action={
                    <button type="button" className={styles.opPanelAction} onClick={() => setOpenId(null)}>
                      Close
                    </button>
                  }
                >
                  <UltimaPlayerSheet
                    player={openPlayer}
                    points={sheetPoints}
                    embedded
                    note={openPlayer.signedBy ? `Signed by ${openPlayer.signedBy}` : null}
                    actions={sheetActions}
                  />
                </UltimaPanel>
              </div>
            ) : null}
            {needsRelease ? (
              <div className={styles.mkSheetDesk}>
                <ReleaseSheet
                  incoming={incoming}
                  options={releases}
                  incomingPts={incomingPts}
                  points={comparePoints}
                  error={error}
                  loading={loading}
                  onPick={submitSign}
                  onRetry={() => lastDrop && submitSign(lastDrop)}
                  onClose={() => setIncoming(null)}
                  desktop
                />
              </div>
            ) : null}
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

      {openPlayer ? (
        <div className={styles.mkSheetMobile}>
          <UltimaPlayerSheet
            player={openPlayer}
            points={sheetPoints}
            onClose={() => setOpenId(null)}
            note={openPlayer.signedBy ? `Signed by ${openPlayer.signedBy}` : null}
            actions={sheetActions}
          />
        </div>
      ) : null}

      {needsRelease ? (
        <div className={styles.mkSheetMobile}>
          <ReleaseSheet
            incoming={incoming}
            options={releases}
            incomingPts={incomingPts}
            points={comparePoints}
            error={error}
            loading={loading}
            onPick={submitSign}
            onRetry={() => lastDrop && submitSign(lastDrop)}
            onClose={() => setIncoming(null)}
          />
        </div>
      ) : null}

      {error && !needsRelease ? (
        <UltimaStaffMessage
          subject={error}
          actionLabel="Retry"
          onAction={() => (incoming ? submitSignDirect(incoming) : null)}
        />
      ) : null}
    </div>
  );
}
