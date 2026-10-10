"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import UltimaCountryTag from "./UltimaCountryTag";
import UltimaPanel from "./UltimaPanel";
import UltimaStaffMessage from "./UltimaStaffMessage";
import UltimaStatsStrip from "./UltimaStatsStrip";
import { useUltimaPlayerCard } from "./UltimaPlayerCard";
import styles from "./ultima.module.css";

const LIVE_POLL_MS = 30_000;
const QUIET_POLL_MS = 5 * 60_000;

const STATE_LABELS = {
  upcoming: "Upcoming",
  live: "Live",
  provisional: "Provisional",
  final: "Final",
};

export default function UltimaMatchdayClient({ initial = null }) {
  const [data, setData] = useState(initial);
  const [failed, setFailed] = useState(!initial);
  const [openId, setOpenId] = useState(initial?.you?.id ?? null);
  const busy = useRef(false);
  const didOpen = useRef(Boolean(initial?.you?.id));

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await fetch("/api/ultima/matchday", { cache: "no-store" });
      if (!res.ok) throw new Error("bad status");
      const next = await res.json();
      setData(next);
      if (!didOpen.current && next?.you?.id) {
        didOpen.current = true;
        setOpenId(next.you.id);
      }
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  }, []);

  // Reads stored scores. The cron writes them. A refresh never closes the open row.
  const anyLive = Boolean(data?.anyLive);
  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") load();
    };
    const id = setInterval(tick, anyLive ? LIVE_POLL_MS : QUIET_POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [anyLive, load]);

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
    { label: "Your points", value: data.waitingForStats ? "Waiting for stats" : you ? String(you.total) : "-" },
    { label: "Your rank", value: you ? String(you.rank) : "-" },
  ];

  return (
    <div className={styles.mdPage}>
      <UltimaStatsStrip items={stats} />
      <p className={styles.mdNote}>
        {data.sample ? <span className={styles.sampleChip}>SAMPLE</span> : null}
        {" "}
        Kickoffs in Dubai time. {STATE_LABELS[data.gameweek.state] ?? data.gameweek.state}.
        {data.updatedAt ? ` ${updatedAgo(data.updatedAt)}.` : ""}
        {failed ? " Could not refresh. Showing the last scores." : ""}
      </p>

      <div className={styles.mdDesk}>
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
                    {m.live ? <span className={styles.mdLive}>LIVE</span> : null}
                  </span>
                  <span className={data.waitingForStats ? styles.mdWait : styles.mdPts}>
                    {data.waitingForStats ? "Waiting for stats" : m.total}
                  </span>
                </button>
                {open ? <XvList xv={m.xv} /> : null}
              </div>
            );
          })}
        </UltimaPanel>

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
      </div>
    </div>
  );
}

function updatedAgo(iso, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return `updated ${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `updated ${minutes}m ago`;
  return `updated ${Math.round(minutes / 60)}h ago`;
}

function pointParts(row) {
  const bits = [];
  if (row.goals) bits.push(`Goal ${row.goals}`);
  if (row.assists) bits.push(`Assist ${row.assists}`);
  if (row.rating) bits.push(`Rating ${row.rating}`);
  if (row.captainExtra) bits.push(`Captain +${row.captainExtra}`);
  if (row.bolt) bits.push(`Bolt +${row.bolt}`);
  return bits.join(" · ");
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
                {pointParts(r) ? <span className={styles.mdBreak}>{pointParts(r)}</span> : null}
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
