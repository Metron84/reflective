"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatGstTime } from "@/lib/ultima/gst";
import UltimaCountryTag from "./UltimaCountryTag";
import UltimaPanel from "./UltimaPanel";
import UltimaStaffMessage from "./UltimaStaffMessage";
import UltimaStatsStrip from "./UltimaStatsStrip";
import { useUltimaPlayerCard } from "./UltimaPlayerCard";
import styles from "./ultima.module.css";

const POLL_MS = 60_000;

const STATE_LABELS = {
  upcoming: "Upcoming",
  live: "Live",
  provisional: "Provisional",
  final: "Final",
};

export default function UltimaMatchdayClient({ initial = null }) {
  const [data, setData] = useState(initial);
  const [failed, setFailed] = useState(!initial);
  const [openId, setOpenId] = useState(null);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await fetch("/api/ultima/matchday", { cache: "no-store" });
      if (!res.ok) throw new Error("bad status");
      setData(await res.json());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  }, []);

  // One fetch on open asks the server to refresh if it is due. After that, poll
  // only while a match is on, and only while this tab is visible. The server
  // limits the upstream refresh to once every two minutes whoever is polling.
  const pollable = Boolean(data?.pollable);
  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);
  useEffect(() => {
    if (!pollable) return undefined;
    const tick = () => {
      if (document.visibilityState === "visible") load();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [pollable, load]);

  if (!data) {
    return (
      <div className={styles.mdPage}>
        <UltimaStaffMessage
          subject="Matchday did not load"
          body="Check your connection and try again."
          actionLabel="Retry"
          onAction={load}
        />
      </div>
    );
  }

  if (data.noGameweek) {
    return (
      <div className={styles.mdPage}>
        <UltimaStaffMessage
          subject="No gameweek this week"
          body="Matchday opens when the next gameweek starts."
          actionLabel="Squad"
          href="/ultima/squad"
        />
      </div>
    );
  }

  const you = data.you;
  const stats = [
    { label: "Gameweek", value: String(data.gameweek.number) },
    { label: "Status", value: STATE_LABELS[data.gameweek.state] ?? data.gameweek.state },
    { label: "Your points", value: you ? String(you.total) : "-" },
    { label: "Your rank", value: you ? String(you.rank) : "-" },
  ];

  return (
    <div className={styles.mdPage}>
      <UltimaStatsStrip items={stats} />
      <p className={styles.mdNote}>
        Kickoffs in Dubai time.
        {data.updatedAt ? ` Updated ${formatGstTime(data.updatedAt)}.` : ""}
        {failed ? " Could not refresh. Showing the last scores." : ""}
      </p>

      <div className={styles.mdDesk}>
        <UltimaPanel title="Fixtures" live={data.anyLive}>
          {!data.anyFixtures ? (
            <p className={styles.mdEmpty}>No fixtures this gameweek yet.</p>
          ) : null}
          {data.fixtures.map((group) => (
            <div key={group.league}>
              <div className={styles.mdLeagueHead}>
                <UltimaCountryTag league={group.league} />
                <span>{group.label}</span>
              </div>
              {group.fixtures.length ? (
                group.fixtures.map((f) => <FixtureRow key={f.id} fixture={f} />)
              ) : (
                <p className={styles.mdEmpty}>No fixtures this week.</p>
              )}
            </div>
          ))}
        </UltimaPanel>

        <div className={styles.mdSide}>
          <UltimaPanel
            title="My XV"
            action={<span className={styles.opPanelAction}>{you ? you.total : "-"}</span>}
          >
            {you ? <XvList xv={you.xv} /> : <p className={styles.mdEmpty}>No XV set.</p>}
          </UltimaPanel>

          <UltimaPanel title="Managers" action={<span className={styles.opPanelAction}>Gameweek points</span>}>
            {data.managers.map((m) => {
              const open = openId === m.id;
              return (
                <div key={m.id}>
                  <button
                    type="button"
                    className={styles.mdMgr}
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : m.id)}
                  >
                    <span className={styles.mdRank}>{m.rank}</span>
                    <span className={styles.mdMgrName}>
                      {m.name}
                      {m.yours ? <span className={styles.mdYou}>You</span> : null}
                    </span>
                    <span className={styles.mdPts}>{m.total}</span>
                  </button>
                  {open ? <XvList xv={m.xv} compact /> : null}
                </div>
              );
            })}
          </UltimaPanel>
        </div>
      </div>
    </div>
  );
}

function FixtureRow({ fixture }) {
  return (
    <div className={styles.mdFixture}>
      <span className={styles.mdTeams}>
        {fixture.home} <span className={styles.mdVs}>v</span> {fixture.away}
      </span>
      <span className={styles.mdScore}>
        {fixture.score ?? <span className={styles.mdKick}>{fixture.kickoff}</span>}
      </span>
      <span className={fixture.live ? styles.mdLive : styles.mdStatus}>
        {fixture.statusLabel || ""}
      </span>
    </div>
  );
}

function XvList({ xv, compact = false }) {
  const { openPlayer } = useUltimaPlayerCard();
  if (!xv || xv.filledCount === 0) {
    return <p className={styles.mdEmpty}>No XV set.</p>;
  }
  return (
    <div className={compact ? styles.mdXvCompact : undefined}>
      <div className={styles.mdCaps}>
        {xv.countries.map((c) => {
          const cap = c.rows.find((r) => r.captain);
          return (
            <span key={c.league} className={styles.mdCapChip}>
              <UltimaCountryTag league={c.league} />
              {c.visible ? (
                cap ? (
                  <>
                    <span className={styles.sqCap}>C</span> {cap.name}
                  </>
                ) : (
                  <span className={styles.capNone}>No captain</span>
                )
              ) : (
                <span className={styles.capNone}>Hidden</span>
              )}
            </span>
          );
        })}
      </div>
      {xv.countries.map((c) => (
        <div key={c.league}>
          <div className={styles.mdLeagueHead}>
            <UltimaCountryTag league={c.league} />
            <span>{c.label}</span>
          </div>
          {!c.visible ? (
            <p className={styles.mdEmpty}>Hidden until {c.label} kicks off.</p>
          ) : c.rows.length ? (
            c.rows.map((r) => (
              <div key={r.playerId} className={styles.mdPlayer}>
                <span className={styles.mdPlayerName}>
                  <button type="button" className={styles.quietLink} onClick={() => openPlayer(r.playerId)}>
                    {r.name}
                  </button>
                  {r.captain ? <span className={styles.sqCap} title="Captain, scores double">C</span> : null}
                </span>
                <span className={styles.mdPts}>
                  {r.points}
                  {r.captain ? <span className={styles.mdDouble}> x2</span> : null}
                </span>
              </div>
            ))
          ) : (
            <p className={styles.mdEmpty}>Empty slots.</p>
          )}
        </div>
      ))}
    </div>
  );
}
