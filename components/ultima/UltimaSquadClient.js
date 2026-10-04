"use client";

import { useMemo, useState } from "react";
import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_LABELS,
  ULTIMA_LEAGUE_SHORT,
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

function formatXp(player) {
  const value = playerExpected(player);
  return Number.isFinite(value) ? value.toFixed(1) : "-";
}

function lockLabel(openAt, locked) {
  if (locked) {
    if (!openAt) return "Locked";
    return (
      <>
        Locked <UltimaLocalTime value={openAt} format="weekdayTime" />
      </>
    );
  }
  if (!openAt) return "Open";
  return (
    <>
      Locks <UltimaLocalTime value={openAt} format="weekdayTime" />
    </>
  );
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
  const allLocked = Boolean(
    office?.allLocked ?? ULTIMA_LEAGUES.every((l) => lockedLeagues.includes(l)),
  );
  const nextLockAt = office?.nextLockAt ?? null;
  const leagueOpenAt = office?.gameweek?.league_open_at ?? {};
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
  const [pickLeague, setPickLeague] = useState(null);
  const [confirmXv, setConfirmXv] = useState(null);
  const [benchOpen, setBenchOpen] = useState(false);
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
  const floorCounts = useMemo(() => {
    const counts = Object.fromEntries(ULTIMA_LEAGUES.map((l) => [l, 0]));
    for (const row of lineup ?? []) {
      if (row.player_id && row.slot_group in counts) counts[row.slot_group] += 1;
    }
    return counts;
  }, [lineup]);

  const pickPool = useMemo(() => {
    if (!pickLeague) return [];
    return bench.filter((player) => player.league === pickLeague);
  }, [bench, pickLeague]);

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
    setPickLeague(null);
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

  function openEmptyPick(league) {
    if (hideActions || lockedLeagues.includes(league)) return;
    setOpenId(null);
    setPickLeague(league);
    setBenchOpen(true);
    setCollapsed((current) => ({ ...current, [league]: false }));
  }
  const replaceNote =
    !hideActions && openPlayer && !openInXv && !openLocked
      ? (() => {
          const target = replaceTarget(openPlayer);
          if (target.player) {
            return `This starts him in place of ${target.player.name}.`;
          }
          return "This fills an empty slot from the same country.";
        })()
      : null;

  return (
    <div className={styles.sqPage}>
      <UltimaStatsStrip
        items={stats.map((item, index) =>
          index === 0 ? { ...item, value: `${filled}/${ULTIMA_XI_SIZE}` } : item,
        )}
      />

      <div className={styles.sqFloorStrip} aria-label="Country floors">
        {ULTIMA_LEAGUES.map((league) => {
          const count = floorCounts[league] ?? 0;
          const locked = lockedLeagues.includes(league);
          return (
            <div
              key={league}
              className={count >= ULTIMA_XI_FLOOR_PER_LEAGUE ? styles.sqFloorCell : styles.sqFloorCellShort}
            >
              <span className={locked ? styles.sqFloorTagLocked : styles.sqFloorTag}>
                {ULTIMA_LEAGUE_SHORT[league]}
              </span>
              <UltimaStatusBar
                value={`${count}/${ULTIMA_XI_FLOOR_PER_LEAGUE}`}
                ratio={count / ULTIMA_XI_FLOOR_PER_LEAGUE}
              />
            </div>
          );
        })}
      </div>

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
          body="Your squad fills on draft night. 30 rounds, 30 players, at least 3 from each league."
          actionLabel="Open Pre-draft"
          href="/ultima/practice"
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

      {!hideActions && squadSize > 0 ? (
        <div className={styles.sqAutoWrap}>
          <button type="button" className={styles.sqAutoBtn} onClick={proposeAutoFill}>
            Auto-fill best XV
          </button>
        </div>
      ) : null}

      <div className={styles.sqDesk}>
        <div className={styles.sqXv}>
          <UltimaPanel title="Starting XV" raised sample={preview}>
            <p className={styles.sqRule}>3 per country. All 15 score.</p>
            {ULTIMA_LEAGUES.map((league) => {
              const rows = (lineup ?? []).filter((row) => row.slot_group === league);
              const count = rows.filter((row) => row.player_id).length;
              const met = count >= ULTIMA_XI_FLOOR_PER_LEAGUE;
              const leagueLocked = lockedLeagues.includes(league) || hideActions;
              const openAt = leagueOpenAt?.[league] ?? null;
              return (
                <div
                  key={league}
                  className={`${met ? styles.sqGroup : styles.sqGroupShort} ${
                    leagueLocked && !hideActions ? styles.sqGroupLocked : ""
                  }`}
                >
                  <div className={styles.sqGroupHead}>
                    <div className={styles.sqGroupTitle}>
                      <UltimaCountryTag league={league} />
                      <span className={styles.sqGroupLeague}>
                        {ULTIMA_LEAGUE_LABELS[league]}
                      </span>
                      <span className={styles.sqGroupLock}>
                        {lockLabel(openAt, lockedLeagues.includes(league) || allLocked)}
                      </span>
                    </div>
                    <UltimaStatusBar
                      value={`${count}/${ULTIMA_XI_FLOOR_PER_LEAGUE}`}
                      ratio={count / ULTIMA_XI_FLOOR_PER_LEAGUE}
                    />
                  </div>
                  <div className={styles.sqTableHead} aria-hidden="true">
                    <span>Slot</span>
                    <span>Player</span>
                    <span>Club</span>
                    <span>Pos</span>
                    <span>Next</span>
                    <span>Pts</span>
                    <span />
                  </div>
                  {rows.map((row, index) => {
                    const player = row.player_id ? rosterById.get(row.player_id) : null;
                    const slotLabel = `${ULTIMA_LEAGUE_SHORT[league]} ${index + 1}`;
                    return (
                      <PlayerRow
                        key={row.slot}
                        slotLabel={slotLabel}
                        player={player}
                        locked={leagueLocked}
                        points={points}
                        emptyLabel="Empty slot"
                        emptyHint="Pick from bench"
                        onEmptyPick={() => openEmptyPick(league)}
                        actionLabel={
                          player && !leagueLocked ? "Bench" : null
                        }
                        onAction={player && !leagueLocked ? () => benchPlayer(player) : undefined}
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
            action={
              <button
                type="button"
                className={styles.opPanelAction}
                onClick={() => setBenchOpen((open) => !open)}
              >
                {bench.length} · {benchOpen ? "Hide" : "Show"}
              </button>
            }
          >
            <p className={styles.sqRule}>
              {bench.length} players. Scores 0.
            </p>
            {benchOpen
              ? ULTIMA_LEAGUES.map((league) => {
                  const rows = bench.filter((player) => player.league === league);
                  const closed = collapsed[league];
                  return (
                    <div key={league}>
                      <button
                        type="button"
                        className={styles.sqToggle}
                        onClick={() =>
                          setCollapsed((current) => ({
                            ...current,
                            [league]: !current[league],
                          }))
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
                              slotLabel="—"
                              player={player}
                              locked={hideActions || lockedLeagues.includes(league)}
                              points={points}
                              actionLabel={
                                hideActions || lockedLeagues.includes(league)
                                  ? null
                                  : "Start"
                              }
                              onAction={() => startPlayer(player)}
                              onOpen={() => setOpenId(player.id)}
                            />
                          ))}
                    </div>
                  );
                })
              : null}
          </UltimaPanel>
        </div>
      </div>

      {openPlayer ? (
        <UltimaPlayerSheet
          player={openPlayer}
          points={points}
          onClose={() => setOpenId(null)}
          note={replaceNote}
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

      {pickLeague ? (
        <div
          className={styles.dSheet}
          role="dialog"
          aria-modal="true"
          aria-label={`Pick from ${ULTIMA_LEAGUE_LABELS[pickLeague]} bench`}
        >
          <button
            type="button"
            className={styles.dSheetBackdrop}
            aria-label="Close"
            onClick={() => setPickLeague(null)}
          />
          <div className={styles.dSheetPanel}>
            <p className={styles.dSheetName}>
              Pick {ULTIMA_LEAGUE_SHORT[pickLeague]}
            </p>
            <p className={styles.dSheetMeta}>
              Same country only. Sorted by expected points.
            </p>
            {pickPool.length ? (
              <ul className={styles.sqPickList}>
                {pickPool.map((player) => (
                  <li key={player.id}>
                    <button
                      type="button"
                      className={styles.sqPickRow}
                      disabled={saving}
                      onClick={() => startPlayer(player)}
                    >
                      <span className={styles.sqPickCopy}>
                        <span className={styles.sqName}>
                          {player.name}
                          {player.bolt_eligible ? (
                            <span className={styles.sqBolt}>Bolt</span>
                          ) : null}
                        </span>
                        <span className={styles.sqMeta}>
                          {player.club || "-"} · {player.position || "-"}
                        </span>
                      </span>
                      <span className={styles.sqPts}>
                        <UltimaValueNumber
                          value={playerExpected(player)}
                          percentile={percentileInList(playerExpected(player), points)}
                          digits={1}
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.dSheetMeta}>
                No bench players from {ULTIMA_LEAGUE_LABELS[pickLeague]}.
              </p>
            )}
            <div className={styles.dSheetActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setPickLeague(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmXv ? (
        <div
          className={styles.dSheet}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm auto-fill"
        >
          <button
            type="button"
            className={styles.dSheetBackdrop}
            aria-label="Close"
            onClick={() => setConfirmXv(null)}
          />
          <div className={styles.dSheetPanel}>
            <p className={styles.dSheetName}>Auto-fill best XV</p>
            <p className={styles.dSheetMeta}>
              Top 3 expected points per country. Nothing changes until you save.
            </p>
            <div className={styles.sqSwapBlock}>
              <p className={styles.sqSwapLabel}>In</p>
              {confirmXv.inn.length ? (
                <ul className={styles.sqSwapList}>
                  {confirmXv.inn.map((player) => (
                    <li key={player.id}>
                      <span>
                        {player.name}{" "}
                        <span className={styles.sqMeta}>
                          {ULTIMA_LEAGUE_SHORT[player.league]} · xP {formatXp(player)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.dSheetMeta}>No one comes in.</p>
              )}
            </div>
            <div className={styles.sqSwapBlock}>
              <p className={styles.sqSwapLabelOut}>Out to bench</p>
              {confirmXv.out.length ? (
                <ul className={styles.sqSwapList}>
                  {confirmXv.out.map((player) => (
                    <li key={player.id}>
                      <span>
                        {player.name}{" "}
                        <span className={styles.sqMeta}>
                          {ULTIMA_LEAGUE_SHORT[player.league]} · xP {formatXp(player)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.dSheetMeta}>No one drops to the bench.</p>
              )}
            </div>
            <div className={styles.dSheetActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setConfirmXv(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={saving}
                onClick={confirmAutoFill}
              >
                {saving ? "Saving…" : "Save XV"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LockLine({ nextLockAt, allLocked }) {
  if (allLocked) {
    return (
      <p className={styles.sqLockDone}>
        All five countries are locked. Your XV is final for this gameweek.
      </p>
    );
  }
  if (nextLockAt && Date.now() >= new Date(nextLockAt).getTime()) {
    return <p className={styles.sqLockDone}>Locked</p>;
  }
  if (!nextLockAt) return null;
  return (
    <p className={styles.sqLock}>
      Next lock <UltimaLocalTime value={nextLockAt} format="weekdayTime" />
    </p>
  );
}

function PlayerRow({
  player,
  locked,
  points,
  slotLabel,
  emptyLabel,
  emptyHint,
  onEmptyPick,
  actionLabel,
  onAction,
  onOpen,
}) {
  if (!player) {
    return (
      <div className={`${styles.sqRow} ${styles.sqRowEmpty}`}>
        <span className={styles.sqSlot}>{slotLabel}</span>
        {onEmptyPick && !locked ? (
          <button type="button" className={styles.sqEmptyBtn} onClick={onEmptyPick}>
            <span className={styles.sqName}>{emptyLabel}</span>
            <span className={styles.sqMeta}>{emptyHint}</span>
          </button>
        ) : (
          <div className={styles.sqEmptyBtn}>
            <span className={styles.sqName}>{emptyLabel}</span>
          </div>
        )}
        <span className={styles.sqDeskOnly} />
        <span className={styles.sqDeskOnly} />
        <span className={styles.sqDeskOnly} />
        <span className={styles.sqDeskOnly} />
        <span />
      </div>
    );
  }

  const expected = playerExpected(player);
  const lockedPts = player.livePoints ?? player.lastGwPoints;
  const showLockedPts = locked;
  const fixture = player.nextFixture;

  return (
    <div className={`${styles.sqRow} ${locked ? styles.sqRowLocked : ""}`}>
      <span className={styles.sqSlot}>{slotLabel}</span>
      <button type="button" className={styles.sqRowMain} onClick={onOpen}>
        <span className={styles.sqCopy}>
          <span className={styles.sqName}>
            {player.name}
            {player.bolt_eligible ? <span className={styles.sqBolt}>Bolt</span> : null}
            {player.live ? <span className={styles.sqLive}>LIVE</span> : null}
          </span>
          <span className={styles.sqMetaMobile}>
            {player.club || "-"}
            {" · "}
            {player.position || "-"}
            {" · "}
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
        <span className={styles.sqValsMobile}>
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
      <span className={styles.sqDeskOnly}>{player.club || "-"}</span>
      <span className={styles.sqDeskOnly}>{player.position || "-"}</span>
      <span className={styles.sqDeskOnly}>
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
      <span className={`${styles.sqPts} ${styles.sqDeskOnly}`}>
        <UltimaValueNumber
          value={showLockedPts ? lockedPts : expected}
          percentile={showLockedPts ? null : percentileInList(expected, points)}
          digits={1}
        />
      </span>
      {actionLabel ? (
        <button type="button" className={styles.sqStart} onClick={onAction}>
          {actionLabel}
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
