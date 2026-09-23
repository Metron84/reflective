"use client";

import { useMemo, useState } from "react";
import {
  ULTIMA_LEAGUES,
  ULTIMA_SQUAD_SIZE,
  ULTIMA_XI_FLOOR_PER_LEAGUE,
  ULTIMA_XI_SIZE,
} from "@/lib/ultima/constants";
import { emptyLineupTemplate } from "@/lib/ultima/lineup/slots";
import { expectedUltimaPoints } from "@/lib/ultima/projected-points";
import { bestXvLineup, playerExpected, xvDiff } from "@/lib/ultima/squad/best-xv";
import UltimaCountryTag from "./UltimaCountryTag";
import UltimaLocalTime from "./UltimaLocalTime";
import UltimaPanel from "./UltimaPanel";
import UltimaPlayerSheet from "./UltimaPlayerSheet";
import UltimaStaffMessage from "./UltimaStaffMessage";
import UltimaStatsStrip from "./UltimaStatsStrip";
import UltimaStatusBar from "./UltimaStatusBar";
import UltimaValueNumber, { percentileInList } from "./UltimaValueNumber";
import styles from "./ultima.module.css";

function normalizePlayer(player) {
  if (!player) return null;
  const nextFixture =
    player.nextFixture ??
    (typeof player.next_fixture === "string"
      ? { label: player.next_fixture, live: false }
      : null);
  return {
    ...player,
    expectedPoints: player.expectedPoints ?? expectedUltimaPoints(player),
    lastGwPoints: player.lastGwPoints ?? player.last_gw_points ?? null,
    livePoints: player.livePoints ?? null,
    bolt_eligible: Boolean(player.bolt_eligible),
    nextFixture,
    live: Boolean(nextFixture?.live),
  };
}

function dash(value) {
  if (value == null || value === "") return "-";
  if (typeof value === "number" && !Number.isFinite(value)) return "-";
  return value;
}

export default function UltimaSquadClient({
  office = null,
  roster: rosterProp = [],
  lineup: lineupProp = [],
  lockedLeagues: lockedProp = [],
  preview = false,
  openSheetOnMount = false,
}) {
  const players = useMemo(() => {
    const raw = office?.players ?? rosterProp;
    return (raw ?? []).map(normalizePlayer);
  }, [office, rosterProp]);

  const rosterById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const lockedLeagues = office?.lockedLeagues ?? lockedProp;
  const allLocked = Boolean(office?.allLocked ?? ULTIMA_LEAGUES.every((l) => lockedLeagues.includes(l)));
  const nextLockAt = office?.nextLockAt ?? null;
  const stats = office?.stats ?? [
    { label: "XV set", value: "-" },
    { label: "Last gameweek", value: "-" },
    { label: "Season points", value: "-" },
    { label: "Next lock", value: "-" },
  ];
  const squadSize = office?.squadSize ?? players.length;
  const squadCap = office?.squadCap ?? ULTIMA_SQUAD_SIZE;

  const [lineup, setLineup] = useState(() => {
    if (office?.lineup?.length) return office.lineup;
    if (lineupProp?.length) return lineupProp;
    return emptyLineupTemplate();
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(() => {
    if (!openSheetOnMount) return null;
    return players[0]?.id ?? null;
  });
  const [confirmXv, setConfirmXv] = useState(null);
  const [collapsed, setCollapsed] = useState(() =>
    Object.fromEntries(ULTIMA_LEAGUES.map((id) => [id, true])),
  );

  const inXv = useMemo(
    () => new Set((lineup ?? []).filter((row) => row.player_id).map((row) => row.player_id)),
    [lineup],
  );
  const bench = useMemo(
    () =>
      players
        .filter((player) => !inXv.has(player.id))
        .sort((a, b) => playerExpected(b) - playerExpected(a)),
    [inXv, players],
  );
  const points = useMemo(() => players.map((p) => playerExpected(p)), [players]);
  const openPlayer = openId ? rosterById.get(openId) : null;
  const openInXv = openPlayer ? inXv.has(openPlayer.id) : false;
  const openLocked = openPlayer ? lockedLeagues.includes(openPlayer.league) : false;

  function replaceTarget(player) {
    const slots = (lineup ?? []).filter((row) => row.slot_group === player.league);
    const empty = slots.find((row) => !row.player_id);
    if (empty) return { slot: empty, player: null };
    const weakest = slots
      .map((row) => rosterById.get(row.player_id))
      .filter(Boolean)
      .sort((a, b) => playerExpected(a) - playerExpected(b))[0];
    const slot = slots.find((row) => row.player_id === weakest?.id);
    return { slot, player: weakest ?? null };
  }

  function applyLineup(next) {
    setLineup(next);
    return next;
  }

  async function persist(next) {
    if (preview) return true;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/ultima/lineup/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Could not save.");
        return false;
      }
      return true;
    } catch {
      setError("Connection lost. Try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function startPlayer(player) {
    if (allLocked || lockedLeagues.includes(player.league)) return;
    const target = replaceTarget(player);
    if (!target.slot) return;
    const next = (lineup ?? []).map((row) =>
      row.slot === target.slot.slot ? { ...row, player_id: player.id } : row,
    );
    applyLineup(next);
    setOpenId(null);
    await persist(next);
  }

  async function benchPlayer(player) {
    if (allLocked || lockedLeagues.includes(player.league)) return;
    const next = (lineup ?? []).map((row) =>
      row.player_id === player.id ? { ...row, player_id: null } : row,
    );
    applyLineup(next);
    setOpenId(null);
    await persist(next);
  }

  function proposeAutoFill() {
    const next = bestXvLineup(players, lineup, lockedLeagues);
    const { inn, out } = xvDiff(rosterById, lineup, next);
    setConfirmXv({ next, inn, out });
  }

  async function confirmAutoFill() {
    if (!confirmXv) return;
    applyLineup(confirmXv.next);
    setConfirmXv(null);
    await persist(confirmXv.next);
  }

  const hideActions = allLocked || squadSize === 0;
  const filled = (lineup ?? []).filter((row) => row.player_id).length;

  return (
    <div className={styles.sqPage}>
      <UltimaStatsStrip
        items={stats.map((item, index) =>
          index === 0 ? { ...item, value: `${filled}/${ULTIMA_XI_SIZE}` } : item,
        )}
      />
      <LockLine nextLockAt={nextLockAt} allLocked={allLocked} />

      {squadSize > 0 && squadSize < squadCap ? (
        <UltimaStaffMessage
          subject="Squad incomplete"
          body={`Your squad has ${squadSize} of ${squadCap}. Sign free agents in the Market.`}
          actionLabel="Market"
          href="/ultima/market"
        />
      ) : null}

      {squadSize === 0 ? (
        <UltimaStaffMessage
          subject="Squad empty"
          body="Your squad fills on draft night."
        />
      ) : null}

      {error ? (
        <UltimaStaffMessage
          subject="The squad sheet did not save"
          body={error}
          actionLabel="Retry"
          onAction={() => persist(lineup)}
        />
      ) : null}

      <div className={styles.sqDesk}>
        <div className={styles.sqXv}>
          <UltimaPanel
            title="Starting XV"
            raised
            sample={preview}
            action={
              hideActions ? null : (
                <button type="button" className={styles.opPanelAction} onClick={proposeAutoFill}>
                  Auto-fill best XV
                </button>
              )
            }
          >
            {ULTIMA_LEAGUES.map((league) => {
              const rows = (lineup ?? []).filter((row) => row.slot_group === league);
              const count = rows.filter((row) => row.player_id).length;
              const met = count >= ULTIMA_XI_FLOOR_PER_LEAGUE;
              return (
                <div key={league} className={met ? styles.sqGroup : styles.sqGroupShort}>
                  <div className={styles.sqGroupHead}>
                    <UltimaCountryTag league={league} />
                    <UltimaStatusBar
                      value={`${count}/${ULTIMA_XI_FLOOR_PER_LEAGUE}`}
                      ratio={count / ULTIMA_XI_FLOOR_PER_LEAGUE}
                    />
                  </div>
                  {rows.map((row) => {
                    const player = row.player_id ? rosterById.get(row.player_id) : null;
                    return (
                      <PlayerRow
                        key={row.slot}
                        player={player}
                        locked={hideActions}
                        points={points}
                        emptyLabel="Empty slot"
                        onOpen={() => player && setOpenId(player.id)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </UltimaPanel>
        </div>

        <div className={styles.sqBench}>
          <UltimaPanel
            title="Bench"
            sample={preview}
            action={<span className={styles.opPanelAction}>{bench.length}</span>}
          >
            {ULTIMA_LEAGUES.map((league) => {
              const rows = bench.filter((player) => player.league === league);
              const closed = collapsed[league];
              return (
                <div key={league}>
                  <button
                    type="button"
                    className={styles.sqToggle}
                    onClick={() =>
                      setCollapsed((current) => ({ ...current, [league]: !current[league] }))
                    }
                    aria-expanded={!closed}
                  >
                    <UltimaCountryTag league={league} />
                    <span>{rows.length}</span>
                    <span>{closed ? "Show" : "Hide"}</span>
                  </button>
                  {closed
                    ? null
                    : rows.map((player) => (
                        <PlayerRow
                          key={player.id}
                          player={player}
                          locked={hideActions || lockedLeagues.includes(league)}
                          points={points}
                          actionLabel={
                            hideActions || lockedLeagues.includes(league) ? null : "Start"
                          }
                          onAction={() => startPlayer(player)}
                          onOpen={() => setOpenId(player.id)}
                        />
                      ))}
                </div>
              );
            })}
          </UltimaPanel>
        </div>
      </div>

      {openPlayer ? (
        <UltimaPlayerSheet
          player={openPlayer}
          points={points}
          onClose={() => setOpenId(null)}
          note={
            !hideActions && !openInXv && !openLocked
              ? replaceTarget(openPlayer).player
                ? `This starts him in place of ${replaceTarget(openPlayer).player.name}.`
                : "This fills an empty slot from the same country."
              : null
          }
          actions={
            hideActions || openLocked
              ? []
              : openInXv
                ? [
                    {
                      label: "Move to bench",
                      primary: true,
                      disabled: saving,
                      onClick: () => benchPlayer(openPlayer),
                    },
                  ]
                : [
                    {
                      label: "Start",
                      primary: true,
                      disabled: saving,
                      onClick: () => startPlayer(openPlayer),
                    },
                  ]
          }
        />
      ) : null}

      {confirmXv ? (
        <div className={styles.dSheet} role="dialog" aria-modal="true" aria-label="Confirm auto-fill">
          <button
            type="button"
            className={styles.dSheetBackdrop}
            aria-label="Close"
            onClick={() => setConfirmXv(null)}
          />
          <div className={styles.dSheetPanel}>
            <p className={styles.dSheetName}>Auto-fill best XV</p>
            <p className={styles.dSheetMeta}>Top 3 expected points per country.</p>
            {confirmXv.inn.length ? (
              <p className={styles.dSheetMeta}>
                In: {confirmXv.inn.map((p) => p.name).join(", ")}
              </p>
            ) : (
              <p className={styles.dSheetMeta}>No one comes in.</p>
            )}
            {confirmXv.out.length ? (
              <p className={styles.dSheetMeta}>
                Out: {confirmXv.out.map((p) => p.name).join(", ")}
              </p>
            ) : (
              <p className={styles.dSheetMeta}>No one drops to the bench.</p>
            )}
            <div className={styles.dSheetActions}>
              <button type="button" className={styles.primaryBtn} disabled={saving} onClick={confirmAutoFill}>
                {saving ? "Saving…" : "Save XV"}
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={() => setConfirmXv(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LockLine({ nextLockAt, allLocked }) {
  if (allLocked || (nextLockAt && Date.now() >= new Date(nextLockAt).getTime())) {
    return <p className={styles.sqLockDone}>Locked</p>;
  }
  if (!nextLockAt) return null;
  return (
    <p className={styles.sqLock}>
      XV locks <UltimaLocalTime value={nextLockAt} format="weekdayTime" />
    </p>
  );
}

function PlayerRow({ player, locked, points, emptyLabel, actionLabel, onAction, onOpen }) {
  if (!player) {
    return (
      <div className={styles.sqRow}>
        <p className={styles.sqName}>{emptyLabel}</p>
      </div>
    );
  }

  const expected = playerExpected(player);
  const lockedPts = player.livePoints ?? player.lastGwPoints;
  const showLockedPts = locked;
  const fixture = player.nextFixture;

  return (
    <div className={styles.sqRow}>
      <button type="button" className={styles.sqRowMain} onClick={onOpen}>
        <span className={styles.sqCopy}>
          <span className={styles.sqName}>
            {player.name}
            {player.bolt_eligible ? <span className={styles.sqBolt}>Bolt</span> : null}
            {player.live ? <span className={styles.sqLive}>LIVE</span> : null}
          </span>
          <span className={styles.sqMeta}>
            {player.club || "-"}
            {" · "}
            {player.position || "-"}
          </span>
          <span className={styles.sqMeta}>
            {fixture?.live
              ? "LIVE"
              : fixture?.kickoff
                ? (
                    <>
                      {fixture.venue === "A" ? "@" : "v"} {fixture.opponent || "-"}
                      {" · "}
                      <UltimaLocalTime value={fixture.kickoff} />
                    </>
                  )
                : fixture?.label || "-"}
          </span>
        </span>
        <span className={styles.sqVals}>
          <span className={styles.sqPts}>
            <UltimaValueNumber
              value={showLockedPts ? lockedPts : expected}
              percentile={showLockedPts ? null : percentileInList(expected, points)}
              digits={1}
            />
          </span>
          <span className={styles.sqSub}>
            {showLockedPts ? "" : dash(player.lastGwPoints)}
          </span>
        </span>
      </button>
      {actionLabel ? (
        <button type="button" className={styles.sqStart} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
